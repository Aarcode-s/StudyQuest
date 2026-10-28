import datetime as dt

from pydantic import BaseModel


class ProfileBreaks(BaseModel):
    breaks_per_hour: float | None
    avg_break_seconds: int | None


class RoomAverages(BaseModel):
    """Anonymous averages of other room members (None when fewer than 2 others)."""

    breaks_per_hour: float | None
    avg_session_seconds: int | None
    members: int


class Insights(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    sessions: int
    hours: list[int]  # 24 values: focus seconds per India-time hour of day
    peak_hours: list[int]  # hours (0-23) that make up your best study window
    avg_session_seconds: int
    longest_session_seconds: int
    breaks_per_hour: float | None
    avg_break_seconds: int | None
    left_app_count: int
    best_weekday: int | None  # 0 = Monday
    focus_break_ratio: float | None  # focus seconds / break seconds
    avg_rating: float | None
    room: RoomAverages


class WeekMember(BaseModel):
    user_id: int
    username: str
    avatar_key: str | None
    hidden: bool
    # Monday..Sunday: 1 showed up, 0 missed, -1 not yet, 2 rest day
    days: list[int]


class RoomWeek(BaseModel):
    room_id: int
    week_start: dt.date
    min_daily_minutes: int
    weekly_goal_minutes: int | None
    week_seconds: int  # whole room, this week
    members: list[WeekMember]


class WeekReview(BaseModel):
    week_start: dt.date  # Monday
    week_end: dt.date  # Sunday
    iso_week: int
    total_seconds: int
    previous_seconds: int
    change_percent: int | None  # None when there is no previous week
    days: list[int]  # seconds per day Monday..Sunday
    active_days: int
    sessions: int
    best_day: int | None  # weekday index
    best_day_seconds: int
    top_tag: str | None
