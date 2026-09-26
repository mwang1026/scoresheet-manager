"""Add game_lineups table (scraped Score-It starting lineups)

Revision ID: e5f6a7b8c9d0
Revises: c4d5e6f7a8b9
Create Date: 2026-09-26 12:00:00.000000

Raw lineup rows scraped weekly from Scoresheet's Score-It game file. Used to
derive each team's most recent batting order and rotation for playoff
projections. Rows are replaced per (league_id, week_end); prior weeks are kept.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "game_lineups",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("league_id", sa.Integer(), sa.ForeignKey("leagues.id"), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("game_no", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column(
            "opponent_team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False
        ),
        sa.Column("is_home", sa.Boolean(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("slot", sa.Integer(), nullable=False),
        sa.Column("position_code", sa.Integer(), nullable=False),
        sa.Column("pin", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id"), nullable=True),
        sa.Column("is_starter", sa.Boolean(), nullable=False),
        sa.UniqueConstraint(
            "league_id", "week_end", "game_no", "team_id", "seq",
            name="uq_game_lineup_slot",
        ),
    )
    op.create_index(
        "ix_game_lineups_league_week", "game_lineups", ["league_id", "week_end"]
    )


def downgrade() -> None:
    op.drop_index("ix_game_lineups_league_week", table_name="game_lineups")
    op.drop_table("game_lineups")
