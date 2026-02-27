"""Add news scraper columns to player_news table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-26 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make player_id nullable (was NOT NULL, needs to be nullable for unmatched items)
    op.alter_column("player_news", "player_id", nullable=True)

    # Add new columns for scraper metadata
    op.add_column("player_news", sa.Column("raw_player_name", sa.String(200), nullable=True))
    op.add_column("player_news", sa.Column("body", sa.Text(), nullable=True))
    op.add_column("player_news", sa.Column("match_method", sa.String(50), nullable=True))
    op.add_column("player_news", sa.Column("match_confidence", sa.Float(), nullable=True))
    op.add_column(
        "player_news",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Upgrade published_at to timezone-aware
    op.alter_column(
        "player_news",
        "published_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )

    # Add unique index on url (for dedup) and index on published_at (for ordering)
    op.create_index("ix_player_news_url", "player_news", ["url"], unique=True)
    op.create_index("ix_player_news_published_at", "player_news", ["published_at"])


def downgrade() -> None:
    op.drop_index("ix_player_news_published_at", table_name="player_news")
    op.drop_index("ix_player_news_url", table_name="player_news")

    op.alter_column(
        "player_news",
        "published_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )

    op.drop_column("player_news", "created_at")
    op.drop_column("player_news", "match_confidence")
    op.drop_column("player_news", "match_method")
    op.drop_column("player_news", "body")
    op.drop_column("player_news", "raw_player_name")

    op.alter_column("player_news", "player_id", nullable=False)
