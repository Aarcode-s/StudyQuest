from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class SessionRead(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    id: int
    room_id: int
    status: str
    focus_seconds: int
    started_at: datetime
    paused_at: datetime | None
    ended_at: datetime | None
    tag: str | None = None
    rating: int | None = None


class StartRequest(BaseModel):
    tag: Tag | None = None


class PauseRequest(BaseModel):
    # manual: the user pressed pause; left_app: the app went to the background;
    # pomodoro: a Pomodoro break started.
    reason: Literal["manual", "left_app", "pomodoro"] = "manual"


class SessionUpdate(BaseModel):
    """Only the fields you send are changed (send null to clear)."""

    tag: Tag | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
