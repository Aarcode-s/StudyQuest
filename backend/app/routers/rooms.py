from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.rate_limit import limiter
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.room import JoinRequest, RoomCreate, RoomDetail, RoomRead
from app.schemas.stats import Leaderboard
from app.schemas.status import RoomStatus
from app.services import rooms as room_service
from app.services import stats as stats_service
from app.services import status as status_service

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post(
    "",
    response_model=RoomRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a room (you become its owner)",
)
@limiter.limit("10/minute")
def create_room(request: Request, data: RoomCreate, user: CurrentUser, db: DbSession):
    return room_service.create_room(db, user.id, data.name)


@router.post("/join", response_model=RoomRead, summary="Join a room with an invite code")
@limiter.limit("10/minute")
def join_room(request: Request, data: JoinRequest, user: CurrentUser, db: DbSession):
    try:
        return room_service.join_room(db, user.id, data.invite_code)
    except room_service.InvalidInviteCodeError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invalid invite code")
    except room_service.AlreadyMemberError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Already a member of this room")


@router.get("", response_model=list[RoomRead], summary="List the rooms you belong to")
def list_my_rooms(user: CurrentUser, db: DbSession):
    return room_service.list_rooms(db, user.id)


@router.get(
    "/{room_id}",
    response_model=RoomDetail,
    summary="Room details and members (members only)",
)
def get_room(room_id: int, user: CurrentUser, db: DbSession):
    try:
        return room_service.get_room_detail(db, room_id, user.id)
    except room_service.NotAMemberError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Room not found")


@router.get(
    "/{room_id}/status",
    response_model=RoomStatus,
    summary="Who is focusing, on break or idle, plus today's totals",
)
def room_status(room_id: int, user: CurrentUser, db: DbSession):
    try:
        return status_service.get_room_status(db, room_id, user.id)
    except room_service.NotAMemberError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Room not found")


@router.get(
    "/{room_id}/leaderboard",
    response_model=Leaderboard,
    summary="Ranking of members by recorded focus time (members only)",
)
def room_leaderboard(
    room_id: int,
    user: CurrentUser,
    db: DbSession,
    period: Annotated[Literal["today", "week", "month"], Query()] = "today",
):
    try:
        return stats_service.get_leaderboard(db, room_id, user.id, period)
    except room_service.NotAMemberError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Room not found")


@router.post(
    "/{room_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Leave a room (also ends your active session there)",
)
def leave_room(room_id: int, user: CurrentUser, db: DbSession):
    try:
        room_service.leave_room(db, room_id, user.id)
    except room_service.NotAMemberError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Room not found")
    except room_service.OwnerCannotLeaveError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Owner cannot leave while other members remain",
        )
