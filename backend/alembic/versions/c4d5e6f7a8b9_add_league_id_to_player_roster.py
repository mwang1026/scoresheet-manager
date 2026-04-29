"""Add league_id to player_roster + unique (league_id, player_id)

Revision ID: c4d5e6f7a8b9
Revises: 2e43b35d75fe
Create Date: 2026-04-29 14:30:00.000000

Backstory: trades after the draft, plus a divergence between the projected
draft order (compute_upcoming_picks) and the -T.js truth, were producing
duplicate player_roster rows where the same player ended up on two teams in
the same league. This migration adds a denormalized league_id and the
uq_player_roster_league_player constraint that makes that state impossible.

Dedupe before adding the constraint: keep the lowest-id row per
(league_id, player_id). The repair script (app/scripts/repair_draft_and_rosters.py)
re-runs the scrapers afterward so kept rows reflect Scoresheet's current truth.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "2e43b35d75fe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "player_roster",
        sa.Column("league_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_player_roster_league",
        "player_roster",
        "leagues",
        ["league_id"],
        ["id"],
    )

    # Backfill league_id from each row's team.
    op.execute(
        """
        UPDATE player_roster
        SET league_id = teams.league_id
        FROM teams
        WHERE player_roster.team_id = teams.id
        """
    )

    # Drop any orphan rows where the team_id no longer resolves to a team.
    # The team_id FK should prevent this, but be defensive — if any slip
    # through, the SET NOT NULL below would otherwise abort the migration.
    op.execute("DELETE FROM player_roster WHERE league_id IS NULL")

    # Dedupe BEFORE adding the unique constraint: keep the lowest-id row per
    # (league_id, player_id) and drop the rest. PostgreSQL evaluates the
    # self-join atomically against the pre-DELETE snapshot, so this is
    # correct for triple+ duplicates as well as pairs. The repair script
    # re-runs the scrapers afterward so kept rows reflect current truth.
    op.execute(
        """
        DELETE FROM player_roster a
        USING player_roster b
        WHERE a.league_id = b.league_id
          AND a.player_id = b.player_id
          AND a.id > b.id
        """
    )

    op.alter_column("player_roster", "league_id", nullable=False)
    op.create_index(
        "ix_player_roster_league_id", "player_roster", ["league_id"]
    )
    op.create_unique_constraint(
        "uq_player_roster_league_player",
        "player_roster",
        ["league_id", "player_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_player_roster_league_player", "player_roster", type_="unique"
    )
    op.drop_index("ix_player_roster_league_id", table_name="player_roster")
    op.drop_constraint(
        "fk_player_roster_league", "player_roster", type_="foreignkey"
    )
    op.drop_column("player_roster", "league_id")
