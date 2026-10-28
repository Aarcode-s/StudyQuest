
from datetime import datetime
from typing import Annotated

from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    StringConstraints,
    Field,
    field_validator,
)

AVATAR_KEYS = (
    "stand", "cheer", "run", "read", "type", "think",
    "wave", "zen", "coffee", "lift", "stretch", "walk",
)

Username = Annotated[
    str, StringConstraints(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class UserCreate(BaseModel):
    email: EmailStr
    username: Username
    password: Password

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    created_at: datetime
    avatar_key: str | None = None
    daily_goal_minutes: int = 120
    weekly_goal_minutes: int = 600
    monthly_goal_minutes: int = 2400
    rest_day: int | None = None
    hide_details: bool = False


class ProfileUpdate(BaseModel):
    """Only the fields you send are changed."""

    avatar_key: Literal[
        "stand", "cheer", "run", "read", "type", "think",
        "wave", "zen", "coffee", "lift", "stretch", "walk",
    ] | None = None
    daily_goal_minutes: int | None = Field(default=None, ge=10, le=1440)
    weekly_goal_minutes: int | None = Field(default=None, ge=10, le=10080)
    monthly_goal_minutes: int | None = Field(default=None, ge=10, le=44640)
    rest_day: int | None = Field(default=None, ge=0, le=6)
    hide_details: bool | None = None

