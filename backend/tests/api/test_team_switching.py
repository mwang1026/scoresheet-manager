"""Tests for team-switching correctness across multiple leagues and users.

Covers the M2M (multi-team, multi-league) scenarios that exercise the
X-Team-Id header scoping for players, teams, watchlist, and draft queue.
Uses the setup_multi_team_context fixture which creates:
  - League A (AL) with teams A1, A2, A3
  - League B (NL) with teams B1, B2, B3
  - User 1 (user1@test.com): owns A1 only
  - User 2 (user2@test.com): owns A2 AND B1 (cross-league)
"""

import pytest

from app.models import DraftQueue, Player, Watchlist


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _al_player(**overrides) -> dict:
    """Return base data for an AL-eligible player (scoresheet_id < 1000)."""
    base = {
        "first_name": "AL",
        "last_name": "Player",
        "scoresheet_id": 1,
        "mlb_id": 100001,
        "primary_position": "SS",
        "bats": "R",
        "throws": "R",
        "age": 25,
        "current_mlb_team": "TST",
        "is_trade_bait": False,
    }
    base.update(overrides)
    return base


def _nl_player(**overrides) -> dict:
    """Return base data for an NL-eligible player (1000 <= scoresheet_id < 2000)."""
    base = {
        "first_name": "NL",
        "last_name": "Player",
        "scoresheet_id": 1001,
        "mlb_id": 200001,
        "primary_position": "OF",
        "bats": "L",
        "throws": "L",
        "age": 27,
        "current_mlb_team": "TST",
        "is_trade_bait": False,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# 1. Players scoped by league
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_players_scoped_to_al_league(client, db_session, setup_multi_team_context):
    """GET /api/players with X-Team-Id in AL league returns only AL-eligible players."""
    ctx = setup_multi_team_context

    al_p1 = Player(**_al_player(scoresheet_id=1, mlb_id=100001))
    al_p2 = Player(**_al_player(scoresheet_id=2, mlb_id=100002, last_name="Player2"))
    nl_p1 = Player(**_nl_player(scoresheet_id=1001, mlb_id=200001))
    db_session.add_all([al_p1, al_p2, nl_p1])
    await db_session.commit()

    resp = await client.get("/api/players", headers={"X-Team-Id": str(ctx["team_a1"].id)})
    assert resp.status_code == 200
    data = resp.json()

    scoresheet_ids = {p["scoresheet_id"] for p in data["players"]}
    assert 1 in scoresheet_ids
    assert 2 in scoresheet_ids
    assert 1001 not in scoresheet_ids, "NL player should not appear in AL league query"


@pytest.mark.asyncio
async def test_players_scoped_to_nl_league(client, db_session, setup_multi_team_context):
    """GET /api/players with X-Team-Id in NL league returns only NL-eligible players."""
    ctx = setup_multi_team_context

    al_p1 = Player(**_al_player(scoresheet_id=1, mlb_id=100001))
    nl_p1 = Player(**_nl_player(scoresheet_id=1001, mlb_id=200001))
    nl_p2 = Player(**_nl_player(scoresheet_id=1002, mlb_id=200002, last_name="Player2"))
    db_session.add_all([al_p1, nl_p1, nl_p2])
    await db_session.commit()

    resp = await client.get("/api/players", headers={"X-Team-Id": str(ctx["team_b1"].id)})
    assert resp.status_code == 200
    data = resp.json()

    scoresheet_ids = {p["scoresheet_id"] for p in data["players"]}
    assert 1001 in scoresheet_ids
    assert 1002 in scoresheet_ids
    assert 1 not in scoresheet_ids, "AL player should not appear in NL league query"


# ---------------------------------------------------------------------------
# 2. Teams scoped by league
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_teams_scoped_to_al_league_via_header(client, db_session, setup_multi_team_context):
    """GET /api/teams with X-Team-Id in AL returns only AL league teams."""
    ctx = setup_multi_team_context

    resp = await client.get("/api/teams", headers={"X-Team-Id": str(ctx["team_a1"].id)})
    assert resp.status_code == 200
    data = resp.json()

    team_ids = {t["id"] for t in data["teams"]}
    assert ctx["team_a1"].id in team_ids
    assert ctx["team_a2"].id in team_ids
    assert ctx["team_a3"].id in team_ids
    assert ctx["team_b1"].id not in team_ids, "NL team must not appear in AL league response"
    assert len(data["teams"]) == 3


@pytest.mark.asyncio
async def test_teams_scoped_to_nl_league_via_header(client, db_session, setup_multi_team_context):
    """GET /api/teams with X-Team-Id in NL returns only NL league teams."""
    ctx = setup_multi_team_context

    resp = await client.get("/api/teams", headers={"X-Team-Id": str(ctx["team_b1"].id)})
    assert resp.status_code == 200
    data = resp.json()

    team_ids = {t["id"] for t in data["teams"]}
    assert ctx["team_b1"].id in team_ids
    assert ctx["team_b2"].id in team_ids
    assert ctx["team_b3"].id in team_ids
    assert ctx["team_a1"].id not in team_ids, "AL team must not appear in NL league response"
    assert len(data["teams"]) == 3


# ---------------------------------------------------------------------------
# 3. is_my_team correctness for cross-league user
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_is_my_team_correct_for_al_context(client, db_session, setup_multi_team_context):
    """With X-Team-Id pointing to user2's AL team, only team_a2 has is_my_team=True."""
    ctx = setup_multi_team_context

    resp = await client.get(
        "/api/teams",
        headers={
            "X-Team-Id": str(ctx["team_a2"].id),
            "X-User-Email": "user2@test.com",
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    for team in data["teams"]:
        if team["id"] == ctx["team_a2"].id:
            assert team["is_my_team"] is True, "team_a2 should be is_my_team for user2"
        else:
            assert team["is_my_team"] is False


@pytest.mark.asyncio
async def test_is_my_team_correct_for_nl_context(client, db_session, setup_multi_team_context):
    """With X-Team-Id pointing to user2's NL team, only team_b1 has is_my_team=True."""
    ctx = setup_multi_team_context

    resp = await client.get(
        "/api/teams",
        headers={
            "X-Team-Id": str(ctx["team_b1"].id),
            "X-User-Email": "user2@test.com",
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    for team in data["teams"]:
        if team["id"] == ctx["team_b1"].id:
            assert team["is_my_team"] is True, "team_b1 should be is_my_team for user2"
        else:
            assert team["is_my_team"] is False


# ---------------------------------------------------------------------------
# 4. Watchlist isolation across teams
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_watchlist_isolated_by_team(client, db_session, setup_multi_team_context):
    """Watchlist entries for team_a2 are not visible when fetching as team_b1."""
    ctx = setup_multi_team_context

    player = Player(**_al_player(scoresheet_id=1, mlb_id=100001))
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add player to team_a2's watchlist
    wl = Watchlist(team_id=ctx["team_a2"].id, player_id=player.id)
    db_session.add(wl)
    await db_session.commit()

    # Fetch watchlist as team_a2 — should see the player
    resp_a2 = await client.get("/api/watchlist", headers={"X-Team-Id": str(ctx["team_a2"].id)})
    assert resp_a2.status_code == 200
    assert player.id in resp_a2.json()["player_ids"]

    # Fetch watchlist as team_b1 — must NOT see team_a2's player
    resp_b1 = await client.get("/api/watchlist", headers={"X-Team-Id": str(ctx["team_b1"].id)})
    assert resp_b1.status_code == 200
    assert player.id not in resp_b1.json()["player_ids"], (
        "team_b1 must not see team_a2's watchlist entries"
    )


@pytest.mark.asyncio
async def test_watchlist_add_scoped_to_team(client, db_session, setup_multi_team_context):
    """POST /api/watchlist with X-Team-Id: team_a2 only adds to team_a2's watchlist."""
    ctx = setup_multi_team_context

    player = Player(**_al_player(scoresheet_id=1, mlb_id=100001))
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add via team_a2
    resp = await client.post(
        "/api/watchlist",
        json={"player_id": player.id},
        headers={"X-Team-Id": str(ctx["team_a2"].id)},
    )
    assert resp.status_code == 200

    # team_b1 sees empty watchlist
    resp_b1 = await client.get("/api/watchlist", headers={"X-Team-Id": str(ctx["team_b1"].id)})
    assert resp_b1.status_code == 200
    assert resp_b1.json()["player_ids"] == []


# ---------------------------------------------------------------------------
# 5. Draft queue isolation across teams
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_draft_queue_isolated_by_team(client, db_session, setup_multi_team_context):
    """Draft queue entries for team_a2 are not visible when fetching as team_b1."""
    ctx = setup_multi_team_context

    player = Player(**_al_player(scoresheet_id=1, mlb_id=100001))
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add player to team_a2's draft queue
    dq = DraftQueue(team_id=ctx["team_a2"].id, player_id=player.id, rank=1)
    db_session.add(dq)
    await db_session.commit()

    # Fetch as team_a2 — sees it
    resp_a2 = await client.get("/api/draft-queue", headers={"X-Team-Id": str(ctx["team_a2"].id)})
    assert resp_a2.status_code == 200
    assert player.id in resp_a2.json()["player_ids"]

    # Fetch as team_b1 — must not see it
    resp_b1 = await client.get("/api/draft-queue", headers={"X-Team-Id": str(ctx["team_b1"].id)})
    assert resp_b1.status_code == 200
    assert player.id not in resp_b1.json()["player_ids"], (
        "team_b1 must not see team_a2's draft queue"
    )


# ---------------------------------------------------------------------------
# 6. me/teams returns correct count per user
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_me_teams_user1_has_one_team(client, db_session, setup_multi_team_context):
    """GET /api/me/teams for user1 returns exactly 1 team (A1 only)."""
    ctx = setup_multi_team_context

    resp = await client.get(
        "/api/me/teams",
        headers={"X-User-Email": "user1@test.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["teams"]) == 1
    assert data["teams"][0]["id"] == ctx["team_a1"].id


@pytest.mark.asyncio
async def test_me_teams_user2_has_two_cross_league_teams(client, db_session, setup_multi_team_context):
    """GET /api/me/teams for user2 returns 2 teams from different leagues."""
    ctx = setup_multi_team_context

    resp = await client.get(
        "/api/me/teams",
        headers={"X-User-Email": "user2@test.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["teams"]) == 2

    team_ids = {t["id"] for t in data["teams"]}
    assert ctx["team_a2"].id in team_ids
    assert ctx["team_b1"].id in team_ids

    league_names = {t["league_name"] for t in data["teams"]}
    assert "AL Test League" in league_names
    assert "NL Test League" in league_names


# ---------------------------------------------------------------------------
# 7. Shared team: separate watchlists per team (not per user)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_shared_team_separate_watchlists(client, db_session, setup_multi_team_context):
    """If two users both own the same team, watchlist is scoped by team (shared between them)."""
    ctx = setup_multi_team_context
    from app.models import User, UserTeam

    # Add user1 as co-owner of team_a2 (user2 already owns it)
    ut_shared = UserTeam(user_id=ctx["user1"].id, team_id=ctx["team_a2"].id, role="co-owner")
    db_session.add(ut_shared)

    player = Player(**_al_player(scoresheet_id=1, mlb_id=100001))
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # user1 adds player to team_a2's watchlist
    resp_add = await client.post(
        "/api/watchlist",
        json={"player_id": player.id},
        headers={
            "X-Team-Id": str(ctx["team_a2"].id),
            "X-User-Email": "user1@test.com",
        },
    )
    assert resp_add.status_code == 200

    # user2 fetching team_a2's watchlist also sees the player (same team)
    resp_u2 = await client.get(
        "/api/watchlist",
        headers={
            "X-Team-Id": str(ctx["team_a2"].id),
            "X-User-Email": "user2@test.com",
        },
    )
    assert resp_u2.status_code == 200
    assert player.id in resp_u2.json()["player_ids"], (
        "Watchlist is team-scoped, so co-owners share it"
    )

    # But team_a1 (user1's other team) watchlist remains empty
    resp_a1 = await client.get(
        "/api/watchlist",
        headers={
            "X-Team-Id": str(ctx["team_a1"].id),
            "X-User-Email": "user1@test.com",
        },
    )
    assert resp_a1.status_code == 200
    assert resp_a1.json()["player_ids"] == [], (
        "team_a1's watchlist is separate from team_a2's"
    )
