from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Parent class for every ORM model. Alembic reads its metadata."""
