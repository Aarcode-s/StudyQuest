
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
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
            "rating IS NULL OR (rating >= 1 AND rating <= 5)",
            name="ck_focus_sessions_rating_range",
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

    # Filled in when the session ends (all optional).
    tag: Mapped[str | None] = mapped_column(String(20), default=None)
    rating: Mapped[int | None] = mapped_column(SmallInteger, default=None)

    # Break bookkeeping for the insights page.
    pause_count: Mapped[int] = mapped_column(server_default=text("0"), default=0)
    left_app_count: Mapped[int] = mapped_column(server_default=text("0"), default=0)
    break_seconds: Mapped[int] = mapped_column(server_default=text("0"), default=0)
