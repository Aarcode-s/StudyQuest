
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.focus_session import FocusSession
from app.models.room_member import RoomMember
from app.models.user import User
from app.models.room import Room
from app.schemas.room import RoomRead
from app.schemas.status import MemberStatus, RoomStatus
from app.services.rooms import NotAMemberError, get_membership

from app.services.sessions import _is_stale, _now, focus_seconds


def _start_of_today_utc(now: datetime) -> datetime:
    tz = ZoneInfo(settings.app_timezone)
    local_midnight = datetime.combine(now.astimezone(tz).date(), time.min, tzinfo=tz)
    return local_midnight.astimezone(timezone.utc)


def get_room_status(db: Session, room_id: int, user_id: int) -> RoomStatus:
    if get_membership(db, room_id, user_id) is None:
        raise NotAMemberError

    now = _now()
    day_start = _start_of_today_utc(now)

    members = db.execute(
        select(
            RoomMember.user_id,
            User.username,
            User.avatar_key,
            User.daily_goal_minutes,
            User.hide_details,
        )
        .join(User, User.id == RoomMember.user_id)
        .where(RoomMember.room_id == room_id)
        .order_by(User.username)
    ).all()

    # One query: every session in this room that started today or is still active.
    sessions = db.scalars(
        select(FocusSession).where(
            FocusSession.room_id == room_id,
            (FocusSession.started_at >= day_start)
            | FocusSession.status.in_(("focusing", "paused")),
        )
    ).all()

    today_total: dict[int, int] = {}
    active: dict[int, FocusSession] = {}
    for s in sessions:
        if s.started_at >= day_start:
            today_total[s.user_id] = today_total.get(s.user_id, 0) + focus_seconds(
                s, now
            )
        if s.status in ("focusing", "paused"):
            active[s.user_id] = s

    result = []
    for uid, username, avatar, goal, hidden in members:
        s = active.get(uid)
        if s is None or _is_stale(s, now):
            state, elapsed = "idle", 0
        elif s.status == "focusing":
            state = "focusing"
            elapsed = max(0, int((now - s.segment_started_at).total_seconds()))
        else:
            state = "on_break"
            elapsed = max(0, int((now - s.paused_at).total_seconds()))
        result.append(
            MemberStatus(
                user_id=uid,
                username=username,
                state=state,
                elapsed_seconds=elapsed,
                today_seconds=today_total.get(uid, 0),
                avatar_key=avatar,
                daily_goal_minutes=goal,
                hidden=hidden,
            )
        )
    return RoomStatus(room_id=room_id, members=result)



def enrich_rooms(db: Session, rooms: list[RoomRead]) -> list[RoomRead]:
    """Fill in focusing_now and showed_up_today for the room cards."""
    if not rooms:
        return rooms
    now = _now()
    tz = ZoneInfo(settings.app_timezone)
    day_start = _start_of_today_utc(now)
    weekday = now.astimezone(tz).weekday()
    ids = [r.id for r in rooms]

    members = db.execute(
        select(RoomMember.room_id, RoomMember.user_id, User.rest_day)
        .join(User, User.id == RoomMember.user_id)
        .where(RoomMember.room_id.in_(ids))
    ).all()
    sessions = db.scalars(
        select(FocusSession).where(
            FocusSession.room_id.in_(ids),
            (FocusSession.started_at >= day_start)
            | FocusSession.status.in_(("focusing", "paused")),
        )
    ).all()

    secs: dict[tuple[int, int], int] = {}
    focusing: dict[int, set[int]] = {}
    for s in sessions:
        if s.started_at >= day_start:
            k = (s.room_id, s.user_id)
            secs[k] = secs.get(k, 0) + focus_seconds(s, now)
        if s.status == "focusing" and not _is_stale(s, now):
            focusing.setdefault(s.room_id, set()).add(s.user_id)

    for room in rooms:
        need = room.min_daily_minutes * 60
        showed = 0
        for rid, uid, rest in members:
            if rid != room.id:
                continue
            if secs.get((rid, uid), 0) >= need or rest == weekday:
                showed += 1
        room.focusing_now = len(focusing.get(room.id, ()))
        room.showed_up_today = showed
    return rooms
