from fastapi import APIRouter, HTTPException, Request, status

from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserRead
from app.services import auth_sessions
from app.services.auth import DuplicateUserError, authenticate_user, create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, data: UserCreate, db: DbSession):
    try:
        return create_user(db, data)
    except DuplicateUserError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in. Any device that was signed in before is signed out.",
)
@limiter.limit("10/minute")
def login(request: Request, data: LoginRequest, db: DbSession):
    user = authenticate_user(db, data.email, data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    session_key, refresh_token = auth_sessions.start_session(db, user.id)
    return TokenResponse(
        access_token=create_access_token(user.id, session_key),
        refresh_token=refresh_token,
    )


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Trade a refresh token for a new short-lived access token",
)
@limiter.limit("30/minute")
def refresh(request: Request, data: RefreshRequest, db: DbSession):
    result = auth_sessions.refresh(db, data.refresh_token)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_sessions.SESSION_ENDED_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id, session_key = result
    return AccessTokenResponse(access_token=create_access_token(user_id, session_key))


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out (ends your session on the server)",
)
def logout(user: CurrentUser, db: DbSession):
    auth_sessions.end_session(db, user.id)


@router.get("/me", response_model=UserRead)
def me(current_user: CurrentUser):
    return current_user
