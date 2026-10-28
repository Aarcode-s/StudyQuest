
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

RoomName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class RoomCreate(BaseModel):
    name: RoomName
    min_daily_minutes: int = Field(default=10, ge=5, le=240)
    weekly_goal_minutes: int | None = Field(default=None, ge=60, le=6000)


class RoomUpdate(BaseModel):
    """Only the fields you send are changed (weekly_goal_minutes: null clears it)."""

    min_daily_minutes: int | None = Field(default=None, ge=5, le=240)
    weekly_goal_minutes: int | None = Field(default=None, ge=60, le=6000)


class JoinRequest(BaseModel):
    invite_code: str = Field(min_length=1, max_length=16)

    @field_validator("invite_code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class RoomRead(BaseModel):
    id: int
    name: str
    invite_code: str
    role: str
    member_count: int
    created_at: datetime
    min_daily_minutes: int = 10
    weekly_goal_minutes: int | None = None
    focusing_now: int = 0  # members focusing right now
    showed_up_today: int = 0  # members who met today's minimum (or are on a rest day)


class MemberRead(BaseModel):
    user_id: int
    username: str
    role: str
    joined_at: datetime


class RoomDetail(RoomRead):
    members: list[MemberRead]

