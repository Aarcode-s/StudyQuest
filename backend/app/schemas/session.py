from datetime import datetime

from pydantic import BaseModel


class SessionRead(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    id: int
    room_id: int
    status: str
    focus_seconds: int
    started_at: datetime
    paused_at: datetime | None
    ended_at: datetime | None