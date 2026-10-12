from fastapi import APIRouter, HTTPException, Request, status

from app.core.rate_limit import limiter
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.session import SessionRead
from app.services import sessions as svc
from app.services.rooms import NotAMemberError

router = APIRouter(tags=["sessions"])

_NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")


@router.post(
    "/rooms/{room_id}/sessions",
    response_model=SessionRead,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute")
def start(request: Request, room_id: int, user: CurrentUser, db: DbSession):
    try:
        return svc.start_session(db, user.id, room_id)
    except NotAMemberError:
        raise _NOT_FOUND
    except svc.ActiveSessionExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="You already have an active session")


@router.get("/sessions/active", response_model=SessionRead | None)
def active(user: CurrentUser, db: DbSession):
    return svc.get_active_session(db, user.id)


def _transition(fn, db, user, session_id):
    try:
        return fn(db, user.id, session_id)
    except svc.SessionNotFoundError:
        raise _NOT_FOUND
    except svc.InvalidTransitionError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Action not allowed in the session's current state")


@router.post("/sessions/{session_id}/pause", response_model=SessionRead)
def pause(session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.pause_session, db, user, session_id)


@router.post("/sessions/{session_id}/resume", response_model=SessionRead)
def resume(session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.resume_session, db, user, session_id)


@router.post("/sessions/{session_id}/heartbeat", response_model=SessionRead)
@limiter.limit("10/minute")
def heartbeat(request: Request, session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.heartbeat_session, db, user, session_id)


@router.post("/sessions/{session_id}/finish", response_model=SessionRead)
def finish(session_id: int, user: CurrentUser, db: DbSession):
    return _transition(svc.finish_session, db, user, session_id)