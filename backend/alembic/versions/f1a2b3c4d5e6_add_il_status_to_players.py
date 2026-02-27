"""add IL status to players

Revision ID: f1a2b3c4d5e6
Revises: d4e5f6a7b8c9
Create Date: 2026-02-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("players", sa.Column("il_type", sa.String(50), nullable=True))
    op.add_column("players", sa.Column("il_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "il_date")
    op.drop_column("players", "il_type")
