"""add league_type to leagues

Revision ID: a2b3c4d5e6f7
Revises: fcd42b502fd3
Create Date: 2026-02-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'fcd42b502fd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('leagues', sa.Column('league_type', sa.String(length=2), nullable=True))


def downgrade() -> None:
    op.drop_column('leagues', 'league_type')
