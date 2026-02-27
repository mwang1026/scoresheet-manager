"""drop pitches from hitter_daily_stats

Revision ID: a1b2c3d4e5f6
Revises: fcd42b502fd3
Create Date: 2026-02-27 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fcd42b502fd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("hitter_daily_stats", "pitches")


def downgrade() -> None:
    op.add_column(
        "hitter_daily_stats",
        sa.Column("pitches", sa.Integer(), nullable=False, server_default="0"),
    )
