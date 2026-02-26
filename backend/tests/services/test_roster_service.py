"""
Tests for the centralized roster service.

Tests assign_to_roster() and check_player_rostered().
"""

import pytest
from sqlalchemy import select

from app.models import DraftQueue, League, Player, PlayerRoster, RosterStatus, Team, Watchlist
from app.services.roster import assign_to_roster, check_player_rostered


@pytest.mark.asyncio
async def test_assign_to_roster_creates_roster_entry(db_session):
    """assign_to_roster creates a PlayerRoster row with ROSTERED status."""
    league = League(name="Test League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.flush()

    team = Team(league_id=league.id, name="Team 1", scoresheet_id=1)
    db_session.add(team)
    await db_session.flush()

    player = Player(
        first_name="Test", last_name="Player",
        scoresheet_id=100, primary_position="SS",
    )
    db_session.add(player)
    await db_session.flush()

    entry = await assign_to_roster(db_session, player.id, team.id, league.id)

    assert entry.player_id == player.id
    assert entry.team_id == team.id
    assert entry.status == RosterStatus.ROSTERED
    assert entry.added_date is not None


@pytest.mark.asyncio
async def test_assign_to_roster_cleans_draft_queues_league_wide(db_session):
    """assign_to_roster removes the player from ALL draft queues in the league."""
    league = League(name="Test League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.flush()

    team1 = Team(league_id=league.id, name="Team 1", scoresheet_id=1)
    team2 = Team(league_id=league.id, name="Team 2", scoresheet_id=2)
    team3 = Team(league_id=league.id, name="Team 3", scoresheet_id=3)
    db_session.add_all([team1, team2, team3])
    await db_session.flush()

    player = Player(
        first_name="Test", last_name="Player",
        scoresheet_id=100, primary_position="SS",
    )
    db_session.add(player)
    await db_session.flush()

    # Player is in draft queue for team2 and team3
    dq2 = DraftQueue(team_id=team2.id, player_id=player.id, rank=1)
    dq3 = DraftQueue(team_id=team3.id, player_id=player.id, rank=1)
    db_session.add_all([dq2, dq3])
    await db_session.flush()

    # Assign to team1 — should clean team2 and team3 queues
    await assign_to_roster(db_session, player.id, team1.id, league.id)
    await db_session.flush()

    remaining = await db_session.execute(
        select(DraftQueue).where(DraftQueue.player_id == player.id)
    )
    assert len(remaining.scalars().all()) == 0


@pytest.mark.asyncio
async def test_assign_to_roster_does_not_remove_other_league_queues(db_session):
    """assign_to_roster only cleans queues in the same league."""
    league1 = League(name="League 1", season=2026, league_type="AL")
    league2 = League(name="League 2", season=2026, league_type="NL")
    db_session.add_all([league1, league2])
    await db_session.flush()

    team_l1 = Team(league_id=league1.id, name="L1 Team", scoresheet_id=1)
    team_l2 = Team(league_id=league2.id, name="L2 Team", scoresheet_id=1)
    db_session.add_all([team_l1, team_l2])
    await db_session.flush()

    player = Player(
        first_name="Test", last_name="Player",
        scoresheet_id=100, primary_position="SS",
    )
    db_session.add(player)
    await db_session.flush()

    # Player in queue for team in league2
    dq = DraftQueue(team_id=team_l2.id, player_id=player.id, rank=1)
    db_session.add(dq)
    await db_session.flush()

    # Assign in league1 — should NOT touch league2's queue
    await assign_to_roster(db_session, player.id, team_l1.id, league1.id)
    await db_session.flush()

    remaining = await db_session.execute(
        select(DraftQueue).where(
            DraftQueue.player_id == player.id,
            DraftQueue.team_id == team_l2.id,
        )
    )
    assert remaining.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_assign_to_roster_preserves_watchlists(db_session):
    """assign_to_roster does NOT remove watchlist entries."""
    league = League(name="Test League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.flush()

    team = Team(league_id=league.id, name="Team 1", scoresheet_id=1)
    db_session.add(team)
    await db_session.flush()

    player = Player(
        first_name="Test", last_name="Player",
        scoresheet_id=100, primary_position="SS",
    )
    db_session.add(player)
    await db_session.flush()

    wl = Watchlist(team_id=team.id, player_id=player.id)
    db_session.add(wl)
    await db_session.flush()

    await assign_to_roster(db_session, player.id, team.id, league.id)
    await db_session.flush()

    remaining = await db_session.execute(
        select(Watchlist).where(
            Watchlist.player_id == player.id,
            Watchlist.team_id == team.id,
        )
    )
    assert remaining.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_check_player_rostered_true(db_session):
    """check_player_rostered returns (True, team_name) for rostered player."""
    league = League(name="Test League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.flush()

    team = Team(league_id=league.id, name="My Team", scoresheet_id=1)
    db_session.add(team)
    await db_session.flush()

    player = Player(
        first_name="Test", last_name="Player",
        scoresheet_id=100, primary_position="SS",
    )
    db_session.add(player)
    await db_session.flush()

    pr = PlayerRoster(
        player_id=player.id, team_id=team.id,
        status=RosterStatus.ROSTERED,
    )
    db_session.add(pr)
    await db_session.flush()

    is_rostered, team_name = await check_player_rostered(db_session, player.id, league.id)
    assert is_rostered is True
    assert team_name == "My Team"


@pytest.mark.asyncio
async def test_check_player_rostered_false(db_session):
    """check_player_rostered returns (False, None) for unrostered player."""
    league = League(name="Test League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.flush()

    team = Team(league_id=league.id, name="My Team", scoresheet_id=1)
    db_session.add(team)
    await db_session.flush()

    player = Player(
        first_name="Test", last_name="Player",
        scoresheet_id=100, primary_position="SS",
    )
    db_session.add(player)
    await db_session.flush()

    is_rostered, team_name = await check_player_rostered(db_session, player.id, league.id)
    assert is_rostered is False
    assert team_name is None


@pytest.mark.asyncio
async def test_check_player_rostered_league_scoped(db_session):
    """check_player_rostered only checks within the specified league."""
    league1 = League(name="League 1", season=2026, league_type="AL")
    league2 = League(name="League 2", season=2026, league_type="NL")
    db_session.add_all([league1, league2])
    await db_session.flush()

    team1 = Team(league_id=league1.id, name="L1 Team", scoresheet_id=1)
    team2 = Team(league_id=league2.id, name="L2 Team", scoresheet_id=1)
    db_session.add_all([team1, team2])
    await db_session.flush()

    player = Player(
        first_name="Test", last_name="Player",
        scoresheet_id=100, primary_position="SS",
    )
    db_session.add(player)
    await db_session.flush()

    # Rostered in league1 only
    pr = PlayerRoster(
        player_id=player.id, team_id=team1.id,
        status=RosterStatus.ROSTERED,
    )
    db_session.add(pr)
    await db_session.flush()

    # Should be rostered in league1
    is_rostered, _ = await check_player_rostered(db_session, player.id, league1.id)
    assert is_rostered is True

    # Should NOT be rostered in league2
    is_rostered, _ = await check_player_rostered(db_session, player.id, league2.id)
    assert is_rostered is False
