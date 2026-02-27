"""Tests for news API endpoints."""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.player import Player
from app.models.player_news import PlayerNews


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_player(db_session, first_name="Test", last_name="Player",
                         scoresheet_id=9999, mlb_id=999999):
    player = Player(
        first_name=first_name,
        last_name=last_name,
        scoresheet_id=scoresheet_id,
        mlb_id=mlb_id,
        primary_position="SS",
        is_trade_bait=False,
    )
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)
    return player


async def _create_news(db_session, player_id=None, headline="Test headline",
                       url="https://example.com/news/1", days_ago=0,
                       source="RotoWire", raw_player_name="Test Player"):
    published = datetime.now(timezone.utc) - timedelta(days=days_ago)
    news = PlayerNews(
        player_id=player_id,
        source=source,
        headline=headline,
        url=url,
        published_at=published,
        raw_player_name=raw_player_name,
        match_method="exact_name_team" if player_id else "unmatched",
        match_confidence=1.0 if player_id else 0.0,
    )
    db_session.add(news)
    await db_session.commit()
    await db_session.refresh(news)
    return news


# ---------------------------------------------------------------------------
# GET /api/news — dashboard widget
# ---------------------------------------------------------------------------


class TestGetNews:
    @pytest.mark.asyncio
    async def test_empty_state(self, client, db_session):
        """No news → empty list."""
        response = await client.get("/api/news")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_returns_items(self, client, db_session):
        """Returns news items with correct fields."""
        player = await _create_player(db_session)
        news = await _create_news(db_session, player_id=player.id,
                                  headline="Judge homers", url="https://rw.com/1")

        response = await client.get("/api/news")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["headline"] == "Judge homers"
        assert data[0]["player_id"] == player.id
        assert data[0]["source"] == "RotoWire"
        assert data[0]["url"] == "https://rw.com/1"
        assert "published_at" in data[0]
        assert "raw_player_name" in data[0]

    @pytest.mark.asyncio
    async def test_ordering_most_recent_first(self, client, db_session):
        """Items ordered by published_at descending."""
        player = await _create_player(db_session)
        await _create_news(db_session, player.id, "Old news", "https://rw.com/old", days_ago=5)
        await _create_news(db_session, player.id, "New news", "https://rw.com/new", days_ago=0)
        await _create_news(db_session, player.id, "Mid news", "https://rw.com/mid", days_ago=2)

        response = await client.get("/api/news?limit=10")
        data = response.json()
        assert len(data) == 3
        assert data[0]["headline"] == "New news"
        assert data[1]["headline"] == "Mid news"
        assert data[2]["headline"] == "Old news"

    @pytest.mark.asyncio
    async def test_limit(self, client, db_session):
        """Limit parameter restricts result count."""
        player = await _create_player(db_session)
        for i in range(5):
            await _create_news(db_session, player.id, f"News {i}", f"https://rw.com/{i}")

        response = await client.get("/api/news?limit=2")
        assert len(response.json()) == 2

    @pytest.mark.asyncio
    async def test_includes_unmatched(self, client, db_session):
        """Unmatched items (player_id=None) are included in dashboard."""
        await _create_news(db_session, player_id=None, headline="Unmatched",
                           url="https://rw.com/unmatched")

        response = await client.get("/api/news")
        data = response.json()
        assert len(data) == 1
        assert data[0]["player_id"] is None


# ---------------------------------------------------------------------------
# GET /api/news/flags — per-player "has news" flags
# ---------------------------------------------------------------------------


class TestGetNewsFlags:
    @pytest.mark.asyncio
    async def test_empty_state(self, client, db_session):
        """No news → empty player_ids list."""
        response = await client.get("/api/news/flags")
        assert response.status_code == 200
        assert response.json() == {"player_ids": []}

    @pytest.mark.asyncio
    async def test_recent_news(self, client, db_session):
        """Players with recent news appear in flags."""
        p1 = await _create_player(db_session, scoresheet_id=100, mlb_id=100000)
        p2 = await _create_player(db_session, "Other", "Player", scoresheet_id=101, mlb_id=100001)
        await _create_news(db_session, p1.id, "Recent", "https://rw.com/r1", days_ago=1)
        await _create_news(db_session, p2.id, "Recent too", "https://rw.com/r2", days_ago=3)

        response = await client.get("/api/news/flags?days=7")
        data = response.json()
        assert set(data["player_ids"]) == {p1.id, p2.id}

    @pytest.mark.asyncio
    async def test_outside_window(self, client, db_session):
        """Players with only old news are excluded."""
        player = await _create_player(db_session)
        await _create_news(db_session, player.id, "Old", "https://rw.com/old", days_ago=10)

        response = await client.get("/api/news/flags?days=7")
        assert response.json() == {"player_ids": []}

    @pytest.mark.asyncio
    async def test_deduplicates_player_ids(self, client, db_session):
        """Multiple news for same player → only one ID in flags."""
        player = await _create_player(db_session)
        await _create_news(db_session, player.id, "News 1", "https://rw.com/n1", days_ago=0)
        await _create_news(db_session, player.id, "News 2", "https://rw.com/n2", days_ago=1)

        response = await client.get("/api/news/flags")
        data = response.json()
        assert data["player_ids"] == [player.id]

    @pytest.mark.asyncio
    async def test_excludes_unmatched(self, client, db_session):
        """Unmatched items (player_id=None) are excluded from flags."""
        await _create_news(db_session, player_id=None, headline="Unmatched",
                           url="https://rw.com/unmatched")

        response = await client.get("/api/news/flags")
        assert response.json() == {"player_ids": []}


# ---------------------------------------------------------------------------
# GET /api/players/{player_id}/news — player detail
# ---------------------------------------------------------------------------


class TestGetPlayerNews:
    @pytest.mark.asyncio
    async def test_empty_state(self, client, db_session):
        """Unknown player → empty list."""
        response = await client.get("/api/players/99999/news")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_returns_player_news(self, client, db_session):
        """Returns news history for a specific player."""
        player = await _create_player(db_session)
        await _create_news(db_session, player.id, "Player news 1", "https://rw.com/pn1", days_ago=0)
        await _create_news(db_session, player.id, "Player news 2", "https://rw.com/pn2", days_ago=2)

        response = await client.get(f"/api/players/{player.id}/news")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Most recent first
        assert data[0]["headline"] == "Player news 1"
        assert data[1]["headline"] == "Player news 2"

    @pytest.mark.asyncio
    async def test_only_returns_own_news(self, client, db_session):
        """Player news endpoint returns only that player's items."""
        p1 = await _create_player(db_session, scoresheet_id=200, mlb_id=200000)
        p2 = await _create_player(db_session, "Other", "Player", scoresheet_id=201, mlb_id=200001)
        await _create_news(db_session, p1.id, "P1 news", "https://rw.com/p1")
        await _create_news(db_session, p2.id, "P2 news", "https://rw.com/p2")

        response = await client.get(f"/api/players/{p1.id}/news")
        data = response.json()
        assert len(data) == 1
        assert data[0]["headline"] == "P1 news"

    @pytest.mark.asyncio
    async def test_limit(self, client, db_session):
        """Limit parameter works on player news."""
        player = await _create_player(db_session)
        for i in range(5):
            await _create_news(db_session, player.id, f"News {i}", f"https://rw.com/pn{i}")

        response = await client.get(f"/api/players/{player.id}/news?limit=2")
        assert len(response.json()) == 2

    @pytest.mark.asyncio
    async def test_full_response_fields(self, client, db_session):
        """Response includes all PlayerNewsResponse fields."""
        player = await _create_player(db_session)
        await _create_news(db_session, player.id, "Full fields test",
                           "https://rw.com/full")

        response = await client.get(f"/api/players/{player.id}/news")
        item = response.json()[0]
        assert "id" in item
        assert "player_id" in item
        assert "source" in item
        assert "headline" in item
        assert "url" in item
        assert "published_at" in item
        assert "body" in item
        assert "raw_player_name" in item
        assert "match_method" in item
