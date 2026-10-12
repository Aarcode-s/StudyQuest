from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.focus_session import FocusSession
from app.models.room_member import RoomMember
from app.models.user import User
from app.schemas.status import MemberStatus, RoomStatus
from app.services.rooms import NotAMemberError, get_membership
from app.services.sessions import _is_stale, focus_seconds


def _start_of_today_utc(now: datetime) -> datetime:
    tz = ZoneInfo(settings.app_timezone)
    local_midnight = datetime.combine(now.astimezone(tz).date(), time.min, tzinfo=tz)
    return local_midnight.astimezone(timezone.utc)


def get_room_status(db: Session, room_id: int, user_id: int) -> RoomStatus:
    if get_membership(db, room_id, user_id) is None:
        raise NotAMemberError

    now = datetime.now(timezone.utc)
    day_start = _start_of_today_utc(now)

    members = db.execute(
        select(RoomMember.user_id, User.username)
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
            today_total[s.user_id] = today_total.get(s.user_id, 0) + focus_seconds(s, now)
        if s.status in ("focusing", "paused"):
            active[s.user_id] = s

    result = []
    for uid, username in members:
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
            )
        )
    return RoomStatus(room_id=room_id, members=result)