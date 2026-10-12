from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FocusSession(Base):
    __tablename__ = "focus_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('focusing', 'paused', 'finished')",
            name="ck_focus_sessions_status",
        ),
        CheckConstraint(
            "accumulated_seconds >= 0", name="ck_focus_sessions_accumulated_nonneg"
        ),
        CheckConstraint(
            "(status = 'focusing') = (segment_started_at IS NOT NULL)",
            name="ck_focus_sessions_segment_iff_focusing",
        ),
        CheckConstraint(
            "(status = 'paused') = (paused_at IS NOT NULL)",
            name="ck_focus_sessions_paused_iff_paused",
        ),
        CheckConstraint(
            "(status = 'finished') = (ended_at IS NOT NULL)",
            name="ck_focus_sessions_ended_iff_finished",
        ),
        # At most one unfinished session per user.
        Index(
            "uq_focus_sessions_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status IN ('focusing', 'paused')"),
        ),
        Index("ix_focus_sessions_user_started", "user_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(10))
    accumulated_seconds: Mapped[int] = mapped_column(default=0)

    # All timestamps are set by the service from the server's UTC clock,
    # never by the client.
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    segment_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    paused_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )