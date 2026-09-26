"""Lineups API: derived per-team batting orders and rotations."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_optional_league
from app.database import get_db
from app.models import GameLineup, League, Player
from app.schemas.lineups import (
    LineupPitcher,
    LineupSlot,
    LineupsResponse,
    TeamLineup,
)
from app.services.lineups import derive_team_lineups, pitcher_hand
from app.services.scoresheet_scraper.lineup_parser import STARTING_PITCHER_SLOT

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lineups", tags=["lineups"])


@router.get("", response_model=LineupsResponse)
async def get_lineups(
    db: Annotated[AsyncSession, Depends(get_db)],
    league: Annotated[League | None, Depends(get_optional_league)],
) -> LineupsResponse:
    """
    Derived lineups for every team in the current team's league.

    Uses the most recent scraped week. Returns ``week_end=None`` and no
    teams when nothing has been scraped for the league yet.
    """
    if league is None:
        raise HTTPException(status_code=401, detail="No league context")

    latest = await db.execute(
        select(func.max(GameLineup.week_end)).where(GameLineup.league_id == league.id)
    )
    week_end = latest.scalar_one_or_none()
    if week_end is None:
        return LineupsResponse(league_id=league.id, week_end=None, teams=[])

    rows_result = await db.execute(
        select(GameLineup).where(
            GameLineup.league_id == league.id,
            GameLineup.week_end == week_end,
        )
    )
    rows = rows_result.scalars().all()

    sp_player_ids = {
        r.player_id
        for r in rows
        if r.is_starter and r.slot == STARTING_PITCHER_SLOT and r.player_id is not None
    }
    hand_by_player_id: dict[int, str | None] = {}
    if sp_player_ids:
        players_result = await db.execute(
            select(Player).where(Player.id.in_(list(sp_player_ids)))
        )
        for player in players_result.scalars().all():
            hand_by_player_id[player.id] = pitcher_hand(player)

    derived = derive_team_lineups(rows, hand_by_player_id)
    return LineupsResponse(
        league_id=league.id,
        week_end=week_end,
        teams=[
            TeamLineup(
                team_id=t.team_id,
                games=t.games,
                unknown_hand_games=t.unknown_hand_games,
                vs_rhp=[LineupSlot(**vars(s)) for s in t.vs_rhp] if t.vs_rhp is not None else None,
                vs_lhp=[LineupSlot(**vars(s)) for s in t.vs_lhp] if t.vs_lhp is not None else None,
                rotation=[LineupPitcher(**vars(p)) for p in t.rotation],
                relievers=[LineupPitcher(**vars(p)) for p in t.relievers],
            )
            for t in derived
        ],
    )
