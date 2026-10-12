from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.room import Room
    from app.models.user import User


class RoomMember(Base):
    __tablename__ = "room_members"
    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_members_room_user"),
        CheckConstraint("role IN ('owner', 'member')", name="ck_room_members_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(10), default="member")
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    room: Mapped["Room"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")
