from pydantic import BaseModel


class TagSlice(BaseModel):
    """Recorded timer time. This is NOT verified productivity."""

    tag: str
    seconds: int


class MemberTags(BaseModel):
    hidden: bool  # the member keeps details private: no tags are returned
    total_seconds: int  # focus time in this room today (India time)
    tags: list[TagSlice]  # biggest first; at most 5 plus an "Other" slice