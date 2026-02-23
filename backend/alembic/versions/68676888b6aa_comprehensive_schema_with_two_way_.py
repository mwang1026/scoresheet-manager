"""comprehensive schema with two-way player support

Revision ID: 68676888b6aa
Revises:
Create Date: 2026-02-19 22:04:10.997864

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68676888b6aa'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create complete database schema with multi-user support."""

    # 1. Create leagues table
    op.create_table(
        'leagues',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('season', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # 2. Create users table (no team_id in multi-user model)
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # 3. Create players table with check constraint
    op.create_table(
        'players',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('mlb_id', sa.Integer(), nullable=True),
        sa.Column('scoresheet_id', sa.Integer(), nullable=True),
        sa.Column('bp_id', sa.Integer(), nullable=True),
        sa.Column('scoresheet_nl_id', sa.Integer(), nullable=True),
        sa.Column('primary_position', sa.String(length=5), nullable=False),
        sa.Column('bats', sa.String(length=1), nullable=True),
        sa.Column('throws', sa.String(length=1), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('birthday', sa.Date(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('weight', sa.Integer(), nullable=True),
        sa.Column('current_mlb_team', sa.String(length=5), nullable=True),
        sa.Column('is_trade_bait', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('osb_al', sa.Numeric(4, 2), nullable=True),
        sa.Column('ocs_al', sa.Numeric(4, 2), nullable=True),
        sa.Column('osb_nl', sa.Numeric(4, 2), nullable=True),
        sa.Column('ocs_nl', sa.Numeric(4, 2), nullable=True),
        sa.Column('ba_vr', sa.Integer(), nullable=True),
        sa.Column('ob_vr', sa.Integer(), nullable=True),
        sa.Column('sl_vr', sa.Integer(), nullable=True),
        sa.Column('ba_vl', sa.Integer(), nullable=True),
        sa.Column('ob_vl', sa.Integer(), nullable=True),
        sa.Column('sl_vl', sa.Integer(), nullable=True),
        sa.CheckConstraint('scoresheet_id IS NOT NULL OR mlb_id IS NOT NULL', name='check_has_identifier'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('scoresheet_id')
    )
    op.create_index('ix_players_mlb_id', 'players', ['mlb_id'])
    op.create_index('ix_players_scoresheet_id', 'players', ['scoresheet_id'])
    op.create_index('ix_players_bp_id', 'players', ['bp_id'])

    # 4. Create teams table with league FK
    op.create_table(
        'teams',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('scoresheet_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], name='fk_teams_league_id'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('league_id', 'scoresheet_id', name='uq_team_league_scoresheet')
    )

    # 5. Create user_teams association table
    op.create_table(
        'user_teams',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='owner'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'team_id', name='uq_user_team')
    )

    # 6. Create player_news table
    op.create_table(
        'player_news',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(length=100), nullable=False),
        sa.Column('headline', sa.String(length=500), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=False),
        sa.Column('published_at', sa.DateTime(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_player_news_player_id', 'player_news', ['player_id'])

    # 7. Create player_positions table
    op.create_table(
        'player_positions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.String(length=5), nullable=False),
        sa.Column('rating', sa.Numeric(4, 2), nullable=False),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('player_id', 'position', name='uq_player_position')
    )
    op.create_index('ix_player_positions_player_id', 'player_positions', ['player_id'])

    # 8. Create player_roster table
    op.create_table(
        'player_roster',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('added_date', sa.Date(), nullable=True),
        sa.Column('dropped_date', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_player_roster_player_id', 'player_roster', ['player_id'])

    # 9. Create hitter_projections table
    op.create_table(
        'hitter_projections',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('season', sa.Integer(), nullable=False),
        sa.Column('pa', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('g', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ab', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('r', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('b1', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('b2', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('b3', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hr', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('h', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rbi', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hbp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('so', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avg', sa.Numeric(4, 3), nullable=True),
        sa.Column('obp', sa.Numeric(4, 3), nullable=True),
        sa.Column('slg', sa.Numeric(4, 3), nullable=True),
        sa.Column('babip', sa.Numeric(4, 3), nullable=True),
        sa.Column('drc_plus', sa.Integer(), nullable=True),
        sa.Column('drb', sa.Numeric(5, 1), nullable=True),
        sa.Column('drp', sa.Numeric(5, 1), nullable=True),
        sa.Column('vorp', sa.Numeric(5, 1), nullable=True),
        sa.Column('warp', sa.Numeric(4, 1), nullable=True),
        sa.Column('dc_fl', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('drp_str', sa.String(length=50), nullable=True),
        sa.Column('comparables', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('player_id', 'source', name='uq_hitter_proj_player_source')
    )

    # 10. Create pitcher_projections table
    op.create_table(
        'pitcher_projections',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('season', sa.Integer(), nullable=False),
        sa.Column('w', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('l', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sv', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hld', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('g', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('gs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('qs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bf', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ip_outs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('h', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hr', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hbp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('so', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('era', sa.Numeric(5, 2), nullable=True),
        sa.Column('whip', sa.Numeric(4, 2), nullable=True),
        sa.Column('babip', sa.Numeric(4, 3), nullable=True),
        sa.Column('bb9', sa.Numeric(4, 2), nullable=True),
        sa.Column('so9', sa.Numeric(5, 2), nullable=True),
        sa.Column('fip', sa.Numeric(5, 2), nullable=True),
        sa.Column('cfip', sa.Integer(), nullable=True),
        sa.Column('dra', sa.Numeric(5, 2), nullable=True),
        sa.Column('dra_minus', sa.Integer(), nullable=True),
        sa.Column('warp', sa.Numeric(4, 1), nullable=True),
        sa.Column('gb_percent', sa.Numeric(4, 1), nullable=True),
        sa.Column('dc_fl', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('comparables', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('player_id', 'source', name='uq_pitcher_proj_player_source')
    )

    # 11. Create hitter_daily_stats table
    op.create_table(
        'hitter_daily_stats',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('g', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pa', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ab', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('h', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('single', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('double', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('triple', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hr', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('r', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rbi', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('so', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('go', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fo', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ao', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('gdp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ibb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hbp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sf', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sh', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('lob', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pitches', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('player_id', 'date', name='uq_hitter_player_date')
    )
    op.create_index('ix_hitter_player_date', 'hitter_daily_stats', ['player_id', 'date'])
    op.create_index('ix_hitter_date', 'hitter_daily_stats', ['date'])

    # 12. Create pitcher_daily_stats table
    op.create_table(
        'pitcher_daily_stats',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('g', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('gs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('gf', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cg', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sho', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sv', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('svo', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hld', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ip_outs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('w', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('l', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('er', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('r', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bf', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ab', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('h', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('double', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('triple', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hr', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ibb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('hbp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('k', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('go', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fo', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ao', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sb', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sf', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sh', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('wp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bk', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pk', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ir', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('irs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pitches', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('strikes', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('player_id', 'date', name='uq_pitcher_player_date')
    )
    op.create_index('ix_pitcher_player_date', 'pitcher_daily_stats', ['player_id', 'date'])
    op.create_index('ix_pitcher_date', 'pitcher_daily_stats', ['date'])

    # 13. Create watchlist table
    op.create_table(
        'watchlist',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'player_id', name='uq_watchlist_team_player')
    )

    # 14. Create draft_queue table
    op.create_table(
        'draft_queue',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'player_id', name='uq_draft_queue_team_player')
    )

    # 15. Create draft_schedule table
    op.create_table(
        'draft_schedule',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('pick_number', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('scheduled_time', sa.DateTime(), nullable=True),
        sa.Column('actual_player_id', sa.Integer(), nullable=True),
        sa.Column('picked_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], name='fk_draft_schedule_league_id'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.ForeignKeyConstraint(['actual_player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('league_id', 'pick_number', name='uq_draft_schedule_league_pick')
    )


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('draft_schedule')
    op.drop_table('draft_queue')
    op.drop_table('watchlist')
    op.drop_table('pitcher_daily_stats')
    op.drop_table('hitter_daily_stats')
    op.drop_table('pitcher_projections')
    op.drop_table('hitter_projections')
    op.drop_table('player_roster')
    op.drop_table('player_positions')
    op.drop_table('player_news')
    op.drop_table('user_teams')
    op.drop_table('teams')
    op.drop_table('players')
    op.drop_table('users')
    op.drop_table('leagues')
