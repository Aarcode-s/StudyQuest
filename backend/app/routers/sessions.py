from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.rate_limit import limiter
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.session import SessionRead
from app.schemas.stats import DailyStats
from app.services import sessions as svc
from app.services import stats as stats_service
from app.services.rooms import NotAMemberError

router = APIRouter(tags=["sessions"])

_NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")


@router.post(
    "/rooms/{room_id}/sessions",
    response_model=SessionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Start a focus session in a room",
)
@limiter.limit("30/minute")
def start(request: Request, room_id: int, user: CurrentUser, db: DbSession):
    try:
        return svc.start_session(db, user.id, room_id)
    except NotAMemberError:
        raise _NOT_FOUND
    except svc.ActiveSessionExistsError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="You already have an active session"
        )


@router.get(
    "/sessions/active",
    response_model=SessionRead | None,
    summary="Your current session, or null",
)
def active(user: CurrentUser, db: DbSession):
    return svc.get_active_session(db, user.id)


def _transition(fn, db, user, session_id):
    try:
        return fn(db, user.id, session_id)
    except svc.SessionNotFoundError:
        raise _NOT_FOUND
    except svc.InvalidTransitionError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Action not allowed in the session's current state",
        )


@router.post(
    "/sessions/{session_id}/pause",
    response_model=SessionRead,
    summary="Pause (start a break)",
)
def pause(session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.pause_session, db, user, session_id)


@router.post(
    "/sessions/{session_id}/resume",
    response_model=SessionRead,
    summary="Resume after a break",
)
def resume(session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.resume_session, db, user, session_id)


@router.post(
    "/sessions/{session_id}/heartbeat",
    response_model=SessionRead,
    summary="Send a heartbeat while the timer is running",
)
@limiter.limit("10/minute")
def heartbeat(request: Request, session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.heartbeat_session, db, user, session_id)


@router.post(
    "/sessions/{session_id}/finish",
    response_model=SessionRead,
    summary="Finish the session (safe to repeat)",
)
def finish(session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.finish_session, db, user, session_id)


@router.get(
    "/stats/daily",
    response_model=DailyStats,
    tags=["stats"],
    summary="Your focus time per day (India time) plus streaks",
)
def daily_stats(
    user: CurrentUser,
    db: DbSession,
    days: Annotated[int, Query(ge=7, le=400)] = 365,
):
    return stats_service.get_daily_stats(db, user.id, days)
