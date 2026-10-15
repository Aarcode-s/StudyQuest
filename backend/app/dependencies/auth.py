import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.core.security import decode_access_claims
from app.dependencies.db import DbSession
from app.models.auth_session import AuthSession
from app.models.user import User
from app.services.auth_sessions import SESSION_REPLACED_DETAIL

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    claims = decode_access_claims(credentials.credentials)
    if claims is None:
        raise unauthorized
    user_id, session_key = claims
    if session_key is None:  # token from before one-device login existed
        raise unauthorized

    # One query: the user and their (single) signed-in device.
    row = db.execute(
        select(User, AuthSession)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(User.id == user_id)
    ).first()
    if row is None:  # no such user, or logged out
        raise unauthorized
    user, auth_session = row

    if not secrets.compare_digest(auth_session.session_key, session_key):
        # A newer login on another device replaced this one.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=SESSION_REPLACED_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )
    if auth_session.expires_at <= datetime.now(timezone.utc):
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
