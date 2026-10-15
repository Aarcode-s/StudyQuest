from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import settings

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: int, session_key: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if session_key is not None:
        payload["sid"] = session_key  # which login this token belongs to
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_claims(token: str) -> tuple[int, str | None] | None:
    """Returns (user_id, session_key) for a valid, unexpired token, else None."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
        sid = payload.get("sid")
        return int(payload["sub"]), sid if isinstance(sid, str) else None
    except (jwt.PyJWTError, ValueError):
        return None


def decode_access_token(token: str) -> int | None:
    claims = decode_access_claims(token)
    return claims[0] if claims else None
