
from pydantic import BaseModel


class MemberStatus(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    user_id: int
    username: str
    state: str  # "focusing" | "on_break" | "idle"
    elapsed_seconds: int  # time in the current state (0 when idle)
    today_seconds: int  # focus time recorded today (India time)
    avatar_key: str | None = None
    daily_goal_minutes: int = 120  # this member's own daily goal (race finish line)
    hidden: bool = False  # member chose to hide detailed stats


class RoomStatus(BaseModel):
    room_id: int
    members: list[MemberStatus]

