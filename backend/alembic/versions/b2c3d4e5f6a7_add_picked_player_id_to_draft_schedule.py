"""Add picked_player_id to draft_schedule

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-01 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "draft_schedule",
        sa.Column("picked_player_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_draft_schedule_picked_player",
        "draft_schedule",
        "players",
        ["picked_player_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_draft_schedule_picked_player", "draft_schedule", type_="foreignkey")
    op.drop_column("draft_schedule", "picked_player_id")
