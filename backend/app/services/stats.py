import datetime as dt
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.focus_session import FocusSession
from app.models.room_member import RoomMember
from app.models.user import User
from app.schemas.stats import DailyStats, DayTotal, Leaderboard, LeaderboardEntry
from app.services import sessions as session_service
from app.services.rooms import NotAMemberError, get_membership

# A day counts toward a streak when at least this much timer time is recorded.
STREAK_MIN_SECONDS = 10 * 60

# A session counts toward the India-time day on which it STARTED (the same rule
# as "today" in the room status), so a session that runs past midnight is not split.


def _tz() -> ZoneInfo:
    return ZoneInfo(settings.app_timezone)


def _now() -> datetime:
    # Looked up through the module so tests can replace sessions._now.
    return session_service._now()


def _local_midnight_utc(day: dt.date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=_tz()).astimezone(timezone.utc)


def _period_start(period: str, today: dt.date) -> dt.date:
    if period == "today":
        return today
    if period == "week":  # weeks start on Monday
        return today - dt.timedelta(days=today.weekday())
    if period == "month":
        return today.replace(day=1)
    raise ValueError(f"Unknown period: {period}")


def get_leaderboard(
    db: Session, room_id: int, user_id: int, period: str
) -> Leaderboard:
    if get_membership(db, room_id, user_id) is None:
        raise NotAMemberError

    now = _now()
    today = now.astimezone(_tz()).date()
    since = _period_start(period, today)
    since_utc = _local_midnight_utc(since)

    members = db.execute(
        select(RoomMember.user_id, User.username)
        .join(User, User.id == RoomMember.user_id)
        .where(RoomMember.room_id == room_id)
    ).all()

    sessions = db.scalars(
        select(FocusSession).where(
            FocusSession.room_id == room_id,
            FocusSession.started_at >= since_utc,
        )
    ).all()
    totals: dict[int, int] = {}
    for s in sessions:
        totals[s.user_id] = totals.get(s.user_id, 0) + session_service.focus_seconds(
            s, now
        )

    rows = [(uid, name, totals.get(uid, 0)) for uid, name in members]
    rows.sort(key=lambda r: (-r[2], r[1].lower()))

    entries: list[LeaderboardEntry] = []
    rank = 0
    previous: int | None = None
    for position, (uid, name, seconds) in enumerate(rows, start=1):
        if seconds <= 0:
            entries.append(
                LeaderboardEntry(user_id=uid, username=name, seconds=0, rank=None)
            )
            continue
        if seconds != previous:  # equal totals share a rank
            rank = position
            previous = seconds
        entries.append(
            LeaderboardEntry(user_id=uid, username=name, seconds=seconds, rank=rank)
        )
    return Leaderboard(room_id=room_id, period=period, since=since, members=entries)


def get_daily_stats(db: Session, user_id: int, days: int) -> DailyStats:
    """The user's own focus time per India-time day across ALL their rooms."""
    now = _now()
    tz = _tz()
    today = now.astimezone(tz).date()
    first = today - dt.timedelta(days=days - 1)

    sessions = db.scalars(
        select(FocusSession).where(
            FocusSession.user_id == user_id,
            FocusSession.started_at >= _local_midnight_utc(first),
        )
    ).all()
    totals: dict[dt.date, int] = {}
    for s in sessions:
        day = s.started_at.astimezone(tz).date()
        totals[day] = totals.get(day, 0) + session_service.focus_seconds(s, now)

    series = []
    for i in range(days):
        day = first + dt.timedelta(days=i)
        series.append(DayTotal(day=day, seconds=totals.get(day, 0)))

    qualifies = [d.seconds >= STREAK_MIN_SECONDS for d in series]

    longest = run = 0
    for q in qualifies:
        run = run + 1 if q else 0
        longest = max(longest, run)

    # Current streak: consecutive qualifying days ending today. If today has not
    # reached the minimum yet, the streak is still alive and ends yesterday.
    i = len(qualifies) - 1
    if not qualifies[i]:
        i -= 1
    current = 0
    while i >= 0 and qualifies[i]:
        current += 1
        i -= 1

    return DailyStats(
        days=series,
        current_streak=current,
        longest_streak=longest,
        active_days=sum(qualifies),
        total_seconds=sum(d.seconds for d in series),
        streak_min_seconds=STREAK_MIN_SECONDS,
    )
