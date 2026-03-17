"""create draft_notes table

Revision ID: 2e43b35d75fe
Revises: 0a3d9560be8c
Create Date: 2026-03-17 17:40:50.137145

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2e43b35d75fe'
down_revision: Union[str, None] = '0a3d9560be8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('draft_notes',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('team_id', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('team_id', name='uq_draft_notes_team')
    )


def downgrade() -> None:
    op.drop_table('draft_notes')
