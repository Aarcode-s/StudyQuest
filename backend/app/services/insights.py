import datetime as dt
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.focus_session import FocusSession
from app.models.room import Room
from app.models.room_member import RoomMember
from app.models.user import User
from app.schemas.insights import (
    Insights,
    RoomAverages,
    RoomWeek,
    WeekMember,
    WeekReview,
)
from app.services import sessions as session_service
from app.services.rooms import NotAMemberError, get_membership
from app.services.stats import _local_midnight_utc, _now, _tz

WINDOW_DAYS = 90
MIN_OTHERS_FOR_AVERAGE = 2


def _spread_hours(s: FocusSession, focus: int, now: datetime, hours: list[float]) -> None:
    """Spread a session's focus time over the clock hours it spanned (India time)."""
    if focus <= 0:
        return
    wall = max(focus + s.break_seconds, 1)
    tz = _tz()
    start = s.started_at.astimezone(tz)
    end = start + timedelta(seconds=wall)
    cursor = start
    while cursor < end:
        boundary = (cursor.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1))
        chunk_end = min(boundary, end)
        share = (chunk_end - cursor).total_seconds() / wall
        hours[cursor.hour] += focus * share
        cursor = chunk_end


def _breaks(sessions: list[FocusSession], now: datetime):
    focus = sum(session_service.focus_seconds(s, now) for s in sessions)
    pauses = sum(s.pause_count for s in sessions)
    brk = sum(s.break_seconds for s in sessions)
    per_hour = round(pauses / (focus / 3600), 1) if focus >= 600 else None
    avg_break = round(brk / pauses) if pauses else None
    return per_hour, avg_break


def get_insights(db: Session, user_id: int) -> Insights:
    now = _now()
    since = _local_midnight_utc(now.astimezone(_tz()).date() - timedelta(days=WINDOW_DAYS))
    mine = list(db.scalars(
        select(FocusSession).where(
            FocusSession.user_id == user_id, FocusSession.started_at >= since
        )
    ))
    secs = [session_service.focus_seconds(s, now) for s in mine]
    hours = [0.0] * 24
    weekday = [0] * 7
    for s, f in zip(mine, secs):
        _spread_hours(s, f, now, hours)
        weekday[s.started_at.astimezone(_tz()).weekday()] += f

    peak: list[int] = []
    best_sum = 0.0
    for h in range(23):
        pair = hours[h] + hours[h + 1]
        if pair > best_sum:
            best_sum, peak = pair, [h, h + 1]

    per_hour, avg_break = _breaks(mine, now)
    focus_total = sum(secs)
    break_total = sum(s.break_seconds for s in mine)
    ratings = [s.rating for s in mine if s.rating]

    # Anonymous room averages: other people who share a room with me and
    # have not hidden their details.
    my_rooms = select(RoomMember.room_id).where(RoomMember.user_id == user_id)
    others = set(db.scalars(
        select(RoomMember.user_id)
        .join(User, User.id == RoomMember.user_id)
        .where(
            RoomMember.room_id.in_(my_rooms),
            RoomMember.user_id != user_id,
            User.hide_details.is_(False),
        )
    ))
    room_avg = RoomAverages(breaks_per_hour=None, avg_session_seconds=None, members=len(others))
    if len(others) >= MIN_OTHERS_FOR_AVERAGE:
        theirs = list(db.scalars(
            select(FocusSession).where(
                FocusSession.user_id.in_(others), FocusSession.started_at >= since
            )
        ))
        by_user: dict[int, list[FocusSession]] = {}
        for s in theirs:
            by_user.setdefault(s.user_id, []).append(s)
        rates = [r for r in (_breaks(v, now)[0] for v in by_user.values()) if r is not None]
        lengths = [session_service.focus_seconds(s, now) for s in theirs]
        room_avg = RoomAverages(
            breaks_per_hour=round(sum(rates) / len(rates), 1) if rates else None,
            avg_session_seconds=round(sum(lengths) / len(lengths)) if lengths else None,
            members=len(others),
        )

    return Insights(
        sessions=len(mine),
        hours=[round(h) for h in hours],
        peak_hours=peak,
        avg_session_seconds=round(focus_total / len(mine)) if mine else 0,
        longest_session_seconds=max(secs, default=0),
        breaks_per_hour=per_hour,
        avg_break_seconds=avg_break,
        left_app_count=sum(s.left_app_count for s in mine),
        best_weekday=weekday.index(max(weekday)) if any(weekday) else None,
        focus_break_ratio=round(focus_total / break_total, 1) if break_total else None,
        avg_rating=round(sum(ratings) / len(ratings), 1) if ratings else None,
        room=room_avg,
    )


def get_room_week(db: Session, room_id: int, user_id: int) -> RoomWeek:
    if get_membership(db, room_id, user_id) is None:
        raise NotAMemberError
    now = _now()
    today = now.astimezone(_tz()).date()
    monday = today - timedelta(days=today.weekday())
    room = db.get(Room, room_id)
    need = room.min_daily_minutes * 60

    members = db.execute(
        select(RoomMember.user_id, User.username, User.avatar_key, User.rest_day, User.hide_details)
        .join(User, User.id == RoomMember.user_id)
        .where(RoomMember.room_id == room_id)
        .order_by(User.username)
    ).all()
    sessions = db.scalars(
        select(FocusSession).where(
            FocusSession.room_id == room_id,
            FocusSession.started_at >= _local_midnight_utc(monday),
        )
    ).all()
    per: dict[tuple[int, int], int] = {}
    total = 0
    for s in sessions:
        f = session_service.focus_seconds(s, now)
        total += f
        d = (s.started_at.astimezone(_tz()).date() - monday).days
        per[(s.user_id, d)] = per.get((s.user_id, d), 0) + f

    out = []
    for uid, name, avatar, rest, hidden in members:
        days = []
        for d in range(7):
            if per.get((uid, d), 0) >= need:
                days.append(1)
            elif d > today.weekday() or d == today.weekday():
                days.append(2 if rest == d else -1)
            else:
                days.append(2 if rest == d else 0)
        out.append(WeekMember(user_id=uid, username=name, avatar_key=avatar, hidden=hidden, days=days))
    return RoomWeek(
        room_id=room_id,
        week_start=monday,
        min_daily_minutes=room.min_daily_minutes,
        weekly_goal_minutes=room.weekly_goal_minutes,
        week_seconds=total,
        members=out,
    )


def get_review(db: Session, user_id: int, weeks_ago: int = 0) -> WeekReview:
    now = _now()
    today = now.astimezone(_tz()).date()
    monday = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks_ago)
    prev_monday = monday - timedelta(weeks=1)
    next_monday = monday + timedelta(weeks=1)
    sessions = db.scalars(
        select(FocusSession).where(
            FocusSession.user_id == user_id,
            FocusSession.started_at >= _local_midnight_utc(prev_monday),
            FocusSession.started_at < _local_midnight_utc(next_monday),
        )
    ).all()
    days = [0] * 7
    prev = 0
    count = 0
    tags: dict[str, int] = {}
    for s in sessions:
        f = session_service.focus_seconds(s, now)
        day = s.started_at.astimezone(_tz()).date()
        if day < monday:
            prev += f
            continue
        days[(day - monday).days] += f
        count += 1
        if s.tag:
            tags[s.tag] = tags.get(s.tag, 0) + f
    total = sum(days)
    best = max(days)
    return WeekReview(
        week_start=monday,
        week_end=monday + timedelta(days=6),
        iso_week=monday.isocalendar().week,
        total_seconds=total,
        previous_seconds=prev,
        change_percent=round((total - prev) * 100 / prev) if prev else None,
        days=days,
        active_days=sum(1 for d in days if d >= 600),
        sessions=count,
        best_day=days.index(best) if best else None,
        best_day_seconds=best,
        top_tag=max(tags, key=tags.get) if tags else None,
    )
