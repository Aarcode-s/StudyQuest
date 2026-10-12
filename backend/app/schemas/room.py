from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

RoomName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class RoomCreate(BaseModel):
    name: RoomName


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