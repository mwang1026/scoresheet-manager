"""player notes: single-note unique constraint

Revision ID: b7e2f1a3c9d4
Revises: 8a543310be38
Create Date: 2026-02-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b7e2f1a3c9d4'
down_revision: Union[str, None] = '8a543310be38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_player_notes_team_player', table_name='player_notes')
    op.create_unique_constraint('uq_player_notes_team_player', 'player_notes', ['team_id', 'player_id'])


def downgrade() -> None:
    op.drop_constraint('uq_player_notes_team_player', 'player_notes', type_='unique')
    op.create_index('ix_player_notes_team_player', 'player_notes', ['team_id', 'player_id'])
