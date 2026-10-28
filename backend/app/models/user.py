
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, SmallInteger, String, false, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.room_member import RoomMember


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    username: Mapped[str] = mapped_column(String(30), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Profile figure (None = not chosen yet; the app shows "stand").
    avatar_key: Mapped[str | None] = mapped_column(String(20), default=None)
    daily_goal_minutes: Mapped[int] = mapped_column(server_default=text("120"), default=120)
    weekly_goal_minutes: Mapped[int] = mapped_column(server_default=text("600"), default=600)
    monthly_goal_minutes: Mapped[int] = mapped_column(server_default=text("2400"), default=2400)
    # One weekday (0 = Monday) that never counts as a missed day.
    rest_day: Mapped[int | None] = mapped_column(SmallInteger, default=None)
    # Rooms see totals only, and the user is left out of room averages.
    hide_details: Mapped[bool] = mapped_column(Boolean, server_default=false(), default=False)

    memberships: Mapped[list["RoomMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

