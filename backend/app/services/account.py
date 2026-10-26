from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.room_member import RoomMember
from app.models.user import User


def delete_account(db: Session, user: User) -> None:
    """Permanently delete a user and everything that belongs only to them.

    Rooms the user owns: if other members exist, the member who joined earliest
    becomes the new owner (the room and everyone's history stay); if the user is
    the only member, the room is deleted. The database then removes the user's
    memberships, focus sessions and login session automatically (ON DELETE
    CASCADE), so nothing is left behind and nothing blocks the delete.
    """
    owned_rooms = db.scalars(select(Room).where(Room.owner_id == user.id)).all()
    for room in owned_rooms:
        successor = db.scalar(
            select(RoomMember)
            .where(RoomMember.room_id == room.id, RoomMember.user_id != user.id)
            .order_by(RoomMember.joined_at, RoomMember.id)
            .limit(1)
        )
        if successor is None:
            db.delete(room)  # empty after this user leaves
        else:
            room.owner_id = successor.user_id
            successor.role = "owner"
    db.flush()  # apply the ownership changes before the user row goes away
    db.delete(user)
    db.commit()
