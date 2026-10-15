import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession

# How long a login lasts without logging in again. The short-lived access token
# (settings.access_token_expire_minutes) is renewed silently with the refresh token.
REFRESH_TOKEN_DAYS = 30

# The API sends this exact text when a newer login replaced this device, so the
# app can tell the user why they were signed out.
SESSION_REPLACED_DETAIL = "Signed in on another device"
SESSION_ENDED_DETAIL = "Session ended. Please log in again."


def _hash(token: str) -> str:
    # The refresh token is 48 random bytes, so a plain SHA-256 is enough here.
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def start_session(db: Session, user_id: int) -> tuple[str, str]:
    """Make this the user's only signed-in device. Returns (session_key, refresh_token).

    A single atomic upsert: whatever device was signed in before stops working
    on its very next request, even if two logins happen at the same moment.
    """
    session_key = secrets.token_urlsafe(24)
    refresh_token = secrets.token_urlsafe(48)
    expires_at = _now() + timedelta(days=REFRESH_TOKEN_DAYS)

    stmt = pg_insert(AuthSession).values(
        user_id=user_id,
        session_key=session_key,
        refresh_hash=_hash(refresh_token),
        expires_at=expires_at,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[AuthSession.user_id],
        set_={
            "session_key": stmt.excluded.session_key,
            "refresh_hash": stmt.excluded.refresh_hash,
            "expires_at": stmt.excluded.expires_at,
            "created_at": func.now(),
        },
    )
    db.execute(stmt)
    db.commit()
    return session_key, refresh_token


def refresh(db: Session, refresh_token: str) -> tuple[int, str] | None:
    """Check a refresh token. Returns (user_id, session_key), or None if it is
    unknown (replaced by a newer login, or logged out) or expired."""
    row = db.scalar(
        select(AuthSession).where(AuthSession.refresh_hash == _hash(refresh_token))
    )
    if row is None or row.expires_at <= _now():
        return None
    return row.user_id, row.session_key


def end_session(db: Session, user_id: int) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
    db.commit()
