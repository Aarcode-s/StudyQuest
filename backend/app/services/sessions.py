
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.focus_session import FocusSession
from app.schemas.session import SessionRead
from app.services.rooms import NotAMemberError, get_membership


class SessionNotFoundError(Exception):
    """Missing, or belongs to someone else (deliberately indistinguishable)."""


class InvalidTransitionError(Exception):
    """The action isn't allowed in the session's current state."""


class ActiveSessionExistsError(Exception):
    """The user already has an active session."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _grace() -> timedelta:
    return timedelta(seconds=settings.session_heartbeat_grace_seconds)


def _cutoff(s: FocusSession, now: datetime) -> datetime:
    """Latest moment we are willing to count for a focusing session."""
    last = s.last_heartbeat_at or s.segment_started_at
    return min(now, last + _grace())


def _is_stale(s: FocusSession, now: datetime) -> bool:
    last = s.last_heartbeat_at or s.segment_started_at
    return s.status == "focusing" and now > last + _grace()


def focus_seconds(s: FocusSession, now: datetime) -> int:
    total = s.accumulated_seconds
    if s.status == "focusing":
        total += max(0, int((_cutoff(s, now) - s.segment_started_at).total_seconds()))
    return total


def _read(s: FocusSession, now: datetime) -> SessionRead:
    return SessionRead(
        id=s.id,
        room_id=s.room_id,
        status=s.status,
        focus_seconds=focus_seconds(s, now),
        started_at=s.started_at,
        paused_at=s.paused_at,
        ended_at=s.ended_at,
        tag=s.tag,
        rating=s.rating,
    )


def _bank_and_finish(s: FocusSession, now: datetime) -> None:
    """Bank the current stretch (up to the cutoff) and mark finished."""
    if s.status == "focusing":
        s.accumulated_seconds = focus_seconds(s, now)
        end = _cutoff(s, now)
    elif s.status == "paused":
        end = s.paused_at
    else:
        return
    s.status = "finished"
    s.segment_started_at = None
    s.paused_at = None
    s.ended_at = end


def _get_own(db: Session, session_id: int, user_id: int) -> FocusSession:
    s = db.scalar(
        select(FocusSession).where(
            FocusSession.id == session_id, FocusSession.user_id == user_id
        )
    )
    if s is None:
        raise SessionNotFoundError
    return s


def _get_active(db: Session, user_id: int) -> FocusSession | None:
    return db.scalar(
        select(FocusSession).where(
            FocusSession.user_id == user_id,
            FocusSession.status.in_(("focusing", "paused")),
        )
    )


def start_session(
    db: Session, user_id: int, room_id: int, tag: str | None = None
) -> SessionRead:
    if get_membership(db, room_id, user_id) is None:
        raise NotAMemberError

    now = _now()
    active = _get_active(db, user_id)
    if active is not None:
        if _is_stale(active, now):
            _bank_and_finish(active, now)
            db.flush()
        else:
            raise ActiveSessionExistsError

    s = FocusSession(
        user_id=user_id,
        room_id=room_id,
        tag=tag,
        status="focusing",
        accumulated_seconds=0,
        started_at=now,
        segment_started_at=now,
        last_heartbeat_at=now,
    )
    db.add(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ActiveSessionExistsError from None
    db.refresh(s)
    return _read(s, now)


def pause_session(
    db: Session, user_id: int, session_id: int, reason: str = "manual"
) -> SessionRead:
    s = _get_own(db, session_id, user_id)
    if s.status != "focusing":
        raise InvalidTransitionError
    now = _now()
    s.accumulated_seconds = focus_seconds(s, now)
    s.paused_at = _cutoff(s, now)
    s.segment_started_at = None
    s.status = "paused"
    s.pause_count += 1
    if reason == "left_app":
        s.left_app_count += 1
    db.commit()
    db.refresh(s)
    return _read(s, now)


def resume_session(db: Session, user_id: int, session_id: int) -> SessionRead:
    s = _get_own(db, session_id, user_id)
    if s.status != "paused":
        raise InvalidTransitionError
    now = _now()
    if s.paused_at is not None:
        s.break_seconds += max(0, int((now - s.paused_at).total_seconds()))
    s.status = "focusing"
    s.segment_started_at = now
    s.last_heartbeat_at = now
    s.paused_at = None
    db.commit()
    db.refresh(s)
    return _read(s, now)


def heartbeat_session(db: Session, user_id: int, session_id: int) -> SessionRead:
    s = _get_own(db, session_id, user_id)
    now = _now()
    if s.status != "focusing" or _is_stale(s, now):
        raise InvalidTransitionError
    s.last_heartbeat_at = now
    db.commit()
    db.refresh(s)
    return _read(s, now)


def finish_session(db: Session, user_id: int, session_id: int) -> SessionRead:
    s = _get_own(db, session_id, user_id)
    now = _now()
    if s.status != "finished":
        _bank_and_finish(s, now)
        db.commit()
        db.refresh(s)
    return _read(s, now)


def update_session(
    db: Session, user_id: int, session_id: int, fields: dict
) -> SessionRead:
    """Set the tag and/or rating (the end-of-session sheet)."""
    s = _get_own(db, session_id, user_id)
    if "tag" in fields:
        s.tag = fields["tag"]
    if "rating" in fields:
        s.rating = fields["rating"]
    db.commit()
    db.refresh(s)
    return _read(s, _now())


def get_active_session(db: Session, user_id: int) -> SessionRead | None:
    s = _get_active(db, user_id)
    return _read(s, _now()) if s else None


def end_active_session_in_room(db: Session, user_id: int, room_id: int) -> None:
    """Used by leave_room. Does not commit; the caller commits."""
    s = _get_active(db, user_id)
    if s is not None and s.room_id == room_id:
        _bank_and_finish(s, _now())

