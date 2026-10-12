from pydantic import BaseModel


class MemberStatus(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    user_id: int
    username: str
    state: str  # "focusing" | "on_break" | "idle"
    elapsed_seconds: int  # time in the current state (0 when idle)
    today_seconds: int  # focus time recorded today (India time)


class RoomStatus(BaseModel):
    room_id: int
    members: list[MemberStatus]