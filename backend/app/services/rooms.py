
import secrets

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.room_member import RoomMember
from app.models.user import User
from app.schemas.room import MemberRead, RoomDetail, RoomRead

# No 0/O or 1/I, to avoid look-alike mistakes when typing a code.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class InvalidInviteCodeError(Exception):
    """No room has this invite code."""


class AlreadyMemberError(Exception):
    """The user is already in this room."""


class NotAMemberError(Exception):
    """Room doesn't exist or the user isn't in it (deliberately indistinguishable)."""


class NotOwnerError(Exception):
    """Only the room owner may do this."""


class OwnerCannotLeaveError(Exception):
    """Owner still has other members in the room."""


def generate_invite_code(length: int = 8) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def _to_read(room: Room, role: str, member_count: int) -> RoomRead:
    return RoomRead(
        id=room.id,
        name=room.name,
        invite_code=room.invite_code,
        role=role,
        member_count=member_count,
        created_at=room.created_at,
        min_daily_minutes=room.min_daily_minutes,
        weekly_goal_minutes=room.weekly_goal_minutes,
    )


def create_room(
    db: Session,
    user_id: int,
    name: str,
    min_daily_minutes: int = 10,
    weekly_goal_minutes: int | None = None,
) -> RoomRead:
    for _ in range(5):
        room = Room(
            name=name,
            invite_code=generate_invite_code(),
            owner_id=user_id,
            min_daily_minutes=min_daily_minutes,
            weekly_goal_minutes=weekly_goal_minutes,
        )
        room.members.append(RoomMember(user_id=user_id, role="owner"))
        db.add(room)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # most likely an invite code collision: try a new code
            continue
        db.refresh(room)
        return _to_read(room, "owner", 1)
    raise RuntimeError("Could not generate a unique invite code")


def join_room(db: Session, user_id: int, invite_code: str) -> RoomRead:
    room = db.scalar(select(Room).where(Room.invite_code == invite_code))
    if room is None:
        raise InvalidInviteCodeError

    db.add(RoomMember(room_id=room.id, user_id=user_id, role="member"))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AlreadyMemberError from None

    db.refresh(room)
    count = db.scalar(
        select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room.id)
    )
    return _to_read(room, "member", count or 0)


def list_rooms(db: Session, user_id: int) -> list[RoomRead]:
    my_room_ids = select(RoomMember.room_id).where(RoomMember.user_id == user_id)
    counts = (
        select(RoomMember.room_id, func.count().label("n"))
        .where(RoomMember.room_id.in_(my_room_ids))
        .group_by(RoomMember.room_id)
        .subquery()
    )
    stmt = (
        select(Room, RoomMember.role, counts.c.n)
        .join(RoomMember, RoomMember.room_id == Room.id)
        .join(counts, counts.c.room_id == Room.id)
        .where(RoomMember.user_id == user_id)
        .order_by(RoomMember.joined_at.desc())
    )
    return [_to_read(room, role, n) for room, role, n in db.execute(stmt)]


def get_membership(db: Session, room_id: int, user_id: int) -> RoomMember | None:
    return db.scalar(
        select(RoomMember).where(
            RoomMember.room_id == room_id, RoomMember.user_id == user_id
        )
    )


def get_room_detail(db: Session, room_id: int, user_id: int) -> RoomDetail:
    membership = get_membership(db, room_id, user_id)
    if membership is None:
        raise NotAMemberError

    room = db.get(Room, room_id)
    rows = db.execute(
        select(RoomMember, User.username)
        .join(User, User.id == RoomMember.user_id)
        .where(RoomMember.room_id == room_id)
        .order_by(RoomMember.joined_at)
    ).all()
    members = [
        MemberRead(
            user_id=m.user_id, username=username, role=m.role, joined_at=m.joined_at
        )
        for m, username in rows
    ]
    return RoomDetail(
        id=room.id,
        name=room.name,
        invite_code=room.invite_code,
        role=membership.role,
        member_count=len(members),
        created_at=room.created_at,
        min_daily_minutes=room.min_daily_minutes,
        weekly_goal_minutes=room.weekly_goal_minutes,
        members=members,
    )


def delete_room(db: Session, room_id: int, user_id: int) -> None:
    """Owner-only: delete the room, its memberships and the sessions recorded in it."""
    membership = get_membership(db, room_id, user_id)
    if membership is None:
        raise NotAMemberError
    if membership.role != "owner":
        raise NotOwnerError
    db.delete(db.get(Room, room_id))
    db.commit()


def leave_room(db: Session, room_id: int, user_id: int) -> None:
    # Imported here because sessions.py imports this module (circular import).
    from app.services.sessions import end_active_session_in_room

    membership = get_membership(db, room_id, user_id)
    if membership is None:
        raise NotAMemberError

    member_count = db.scalar(
        select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room_id)
    )
    if membership.role == "owner" and (member_count or 0) > 1:
        raise OwnerCannotLeaveError

    # End the user's active session in this room, saved in the same commit.
    end_active_session_in_room(db, user_id, room_id)

    if membership.role == "owner":
        db.delete(db.get(Room, room_id))  # last member: remove the empty room
    else:
        db.delete(membership)
    db.commit()



def update_room(db: Session, room_id: int, user_id: int, fields: dict) -> RoomRead:
    """Owner-only: change the daily minimum and/or the room weekly goal."""
    membership = get_membership(db, room_id, user_id)
    if membership is None:
        raise NotAMemberError
    if membership.role != "owner":
        raise NotOwnerError
    room = db.get(Room, room_id)
    if fields.get("min_daily_minutes") is not None:
        room.min_daily_minutes = fields["min_daily_minutes"]
    if "weekly_goal_minutes" in fields:
        room.weekly_goal_minutes = fields["weekly_goal_minutes"]
    db.commit()
    db.refresh(room)
    count = db.scalar(
        select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room_id)
    )
    return _to_read(room, "owner", count or 0)
