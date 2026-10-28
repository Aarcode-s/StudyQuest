import csv
import io

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.focus_session import FocusSession
from app.models.room import Room
from app.models.user import User
from app.schemas.user import ProfileUpdate


class WrongPasswordError(Exception):
    """The current password is not correct."""


def update_profile(db: Session, user: User, data: ProfileUpdate) -> User:
    sent = data.model_fields_set
    for name in ("daily_goal_minutes", "weekly_goal_minutes", "monthly_goal_minutes", "hide_details"):
        value = getattr(data, name)
        if name in sent and value is not None:
            setattr(user, name, value)
    if "avatar_key" in sent and data.avatar_key is not None:
        user.avatar_key = data.avatar_key
    if "rest_day" in sent:  # null clears the rest day
        user.rest_day = data.rest_day
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise WrongPasswordError
    user.password_hash = hash_password(new)
    db.commit()


def _safe(value: str) -> str:
    """Stop spreadsheet programs from running a cell that starts like a formula."""
    return "'" + value if value[:1] in ("=", "+", "-", "@") else value


def export_csv(db: Session, user: User) -> str:
    """Every session of the user as CSV (recorded timer time)."""
    rows = db.execute(
        select(FocusSession, Room.name)
        .join(Room, Room.id == FocusSession.room_id)
        .where(FocusSession.user_id == user.id)
        .order_by(FocusSession.started_at)
    ).all()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["started_at", "ended_at", "room", "status", "focus_seconds",
                "tag", "rating", "pauses", "left_app", "break_seconds"])
    for s, room in rows:
        w.writerow([
            s.started_at.isoformat(),
            s.ended_at.isoformat() if s.ended_at else "",
            _safe(room), s.status, s.accumulated_seconds,
            _safe(s.tag or ""), s.rating or "", s.pause_count, s.left_app_count, s.break_seconds,
        ])
    return out.getvalue()
