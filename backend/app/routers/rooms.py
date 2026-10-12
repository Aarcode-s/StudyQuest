from fastapi import APIRouter, HTTPException, Request, status

from app.core.rate_limit import limiter
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.room import JoinRequest, RoomCreate, RoomDetail, RoomRead
from app.services import rooms as room_service

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def create_room(request: Request, data: RoomCreate, user: CurrentUser, db: DbSession):
    return room_service.create_room(db, user.id, data.name)


@router.post("/join", response_model=RoomRead)
@limiter.limit("10/minute")
def join_room(request: Request, data: JoinRequest, user: CurrentUser, db: DbSession):
    try:
        return room_service.join_room(db, user.id, data.invite_code)
    except room_service.InvalidInviteCodeError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invalid invite code")
    except room_service.AlreadyMemberError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Already a member of this room")


@router.get("", response_model=list[RoomRead])
def list_my_rooms(user: CurrentUser, db: DbSession):
    return room_service.list_rooms(db, user.id)


@router.get("/{room_id}", response_model=RoomDetail)
def get_room(room_id: int, user: CurrentUser, db: DbSession):
    try:
        return room_service.get_room_detail(db, room_id, user.id)
    except room_service.NotAMemberError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Room not found")


@router.post("/{room_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
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