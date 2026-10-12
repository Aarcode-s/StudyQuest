from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate

# Used to spend the same time on "unknown email" as on "wrong password".
_DUMMY_HASH = hash_password("not-a-real-password")


class DuplicateUserError(Exception):
    """Email or username is already taken."""


def create_user(db: Session, data: UserCreate) -> User:
    existing = db.scalar(
        select(User.id).where(
            (User.email == data.email)
            | (func.lower(User.username) == data.username.lower())
        )
    )
    if existing is not None:
        raise DuplicateUserError

    user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DuplicateUserError from None
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user