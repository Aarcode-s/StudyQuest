"""profiles, goals, room commitment, session tags and break stats

Revision ID: c5e1a9d2f4b8
Revises: b3c9e17a52d4
Create Date: 2026-10-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5e1a9d2f4b8'
down_revision: Union[str, Sequence[str], None] = 'b3c9e17a52d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_key', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('daily_goal_minutes', sa.Integer(), server_default='120', nullable=False))
    op.add_column('users', sa.Column('weekly_goal_minutes', sa.Integer(), server_default='600', nullable=False))
    op.add_column('users', sa.Column('monthly_goal_minutes', sa.Integer(), server_default='2400', nullable=False))
    op.add_column('users', sa.Column('rest_day', sa.SmallInteger(), nullable=True))
    op.add_column('users', sa.Column('hide_details', sa.Boolean(), server_default=sa.false(), nullable=False))

    op.add_column('rooms', sa.Column('min_daily_minutes', sa.Integer(), server_default='10', nullable=False))
    op.add_column('rooms', sa.Column('weekly_goal_minutes', sa.Integer(), nullable=True))

    op.add_column('focus_sessions', sa.Column('tag', sa.String(length=20), nullable=True))
    op.add_column('focus_sessions', sa.Column('rating', sa.SmallInteger(), nullable=True))
    op.add_column('focus_sessions', sa.Column('pause_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('focus_sessions', sa.Column('left_app_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('focus_sessions', sa.Column('break_seconds', sa.Integer(), server_default='0', nullable=False))
    op.create_check_constraint(
        'ck_focus_sessions_rating_range', 'focus_sessions',
        'rating IS NULL OR (rating >= 1 AND rating <= 5)',
    )


def downgrade() -> None:
    op.drop_constraint('ck_focus_sessions_rating_range', 'focus_sessions', type_='check')
    for c in ('break_seconds', 'left_app_count', 'pause_count', 'rating', 'tag'):
        op.drop_column('focus_sessions', c)
    op.drop_column('rooms', 'weekly_goal_minutes')
    op.drop_column('rooms', 'min_daily_minutes')
    for c in ('hide_details', 'rest_day', 'monthly_goal_minutes', 'weekly_goal_minutes', 'daily_goal_minutes', 'avatar_key'):
        op.drop_column('users', c)
