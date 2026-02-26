"""Add draft_schedule table and leagues.draft_complete column

Revision ID: c3d4e5f6a7b8
Revises: b7e2f1a3c9d4
Create Date: 2026-02-26 10:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b7e2f1a3c9d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add draft_complete column to leagues
    op.add_column(
        "leagues",
        sa.Column("draft_complete", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Create draft_schedule table
    op.create_table(
        "draft_schedule",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("league_id", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("pick_in_round", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("from_team_id", sa.Integer(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["from_team_id"], ["teams.id"]),
        sa.UniqueConstraint("league_id", "round", "pick_in_round", name="uq_draft_schedule_league_round_pick"),
    )
    op.create_index(
        "ix_draft_schedule_league_time",
        "draft_schedule",
        ["league_id", "scheduled_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_draft_schedule_league_time", table_name="draft_schedule")
    op.drop_table("draft_schedule")
    op.drop_column("leagues", "draft_complete")
