import datetime as dt

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    user_id: int
    username: str
    seconds: int  # focus time recorded in the period (India time)
    rank: int | None  # None when the member has no recorded time in the period


class Leaderboard(BaseModel):
    room_id: int
    period: str  # "today" | "week" | "month"
    since: dt.date  # first India-time day included in the period
    members: list[LeaderboardEntry]


class DayTotal(BaseModel):
    day: dt.date  # India-time calendar day
    seconds: int


class DailyStats(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    days: list[DayTotal]  # oldest first, ends with today (India time)
    current_streak: int
    longest_streak: int  # longest run inside the returned window
    active_days: int  # days that reached the streak minimum
    total_seconds: int
    streak_min_seconds: int
