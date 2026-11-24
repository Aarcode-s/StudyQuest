from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.focus_session import FocusSession
from app.models.user import User
from app.schemas.tags import MemberTags, TagSlice
from app.services.rooms import NotAMemberError, get_membership
from app.services.sessions import focus_seconds

IST = timezone(timedelta(hours=5, minutes=30))
MAX_TAGS = 5


def get_member_tags_today(
    db: Session, room_id: int, viewer_id: int, member_id: int
) -> MemberTags:
    """Today's focus time of one room member, split by session tag.

    Both people must be in the room. Members who hide their details are
    returned with no tags (the viewer can still see their own).
    """
    if get_membership(db, room_id, viewer_id) is None:
        raise NotAMemberError
    if get_membership(db, room_id, member_id) is None:
        raise NotAMemberError

    member = db.get(User, member_id)
    if member is None:
        raise NotAMemberError
    if member.hide_details and member_id != viewer_id:
        return MemberTags(hidden=True, total_seconds=0, tags=[])

    now = datetime.now(timezone.utc)
    day_start = (
        datetime.now(IST)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .astimezone(timezone.utc)
    )
    sessions = db.scalars(
        select(FocusSession).where(
            FocusSession.user_id == member_id,
            FocusSession.room_id == room_id,
            FocusSession.started_at >= day_start,
        )
    ).all()

    totals: dict[str, int] = {}
    names: dict[str, str] = {}
    for s in sessions:
        secs = focus_seconds(s, now)
        if secs <= 0:
            continue
        raw = (s.tag or "").strip()
        key = raw.lower()  # "Study" and "study " count as one tag
        names.setdefault(key, raw or "No tag")
        totals[key] = totals.get(key, 0) + secs

    ordered = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    slices = [TagSlice(tag=names[k], seconds=v) for k, v in ordered[:MAX_TAGS]]
    rest = sum(v for _, v in ordered[MAX_TAGS:])
    if rest > 0:
        slices.append(TagSlice(tag="Other", seconds=rest))
    return MemberTags(hidden=False, total_seconds=sum(totals.values()), tags=slices)