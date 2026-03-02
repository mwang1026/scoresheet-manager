"""Draft schedule API endpoints."""

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_optional_league
from app.api.endpoints.scoresheet import limiter
from app.database import get_db
from app.models import DraftSchedule, League, Team
from app.schemas.draft_schedule import (
    DraftRefreshResponse,
    DraftScheduleItem,
    DraftScheduleResponse,
)
from app.services.scoresheet_scraper import (
    get_draft_cooldown,
    scrape_and_persist_draft,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/draft", tags=["draft"])


async def _build_schedule_items(
    session: "AsyncSession", league_id: int
) -> list[DraftScheduleItem]:
    """Query DraftSchedule rows and join team names."""
    # Alias for from_team join
    FromTeam = Team.__table__.alias("from_team")

    result = await session.execute(
        select(
            DraftSchedule,
            Team.name.label("team_name"),
        )
        .join(Team, DraftSchedule.team_id == Team.id)
        .where(DraftSchedule.league_id == league_id)
        .where(DraftSchedule.picked_player_id.is_(None))
        .order_by(DraftSchedule.scheduled_at)
    )
    rows = result.all()

    # Batch-fetch from_team names for picks with traded picks
    from_team_ids = {r.DraftSchedule.from_team_id for r in rows if r.DraftSchedule.from_team_id}
    from_team_names: dict[int, str] = {}
    if from_team_ids:
        ft_result = await session.execute(
            select(Team.id, Team.name).where(Team.id.in_(list(from_team_ids)))
        )
        from_team_names = {row[0]: row[1] for row in ft_result.all()}

    return [
        DraftScheduleItem(
            round=r.DraftSchedule.round,
            pick_in_round=r.DraftSchedule.pick_in_round,
            team_id=r.DraftSchedule.team_id,
            team_name=r.team_name,
            from_team_name=from_team_names.get(r.DraftSchedule.from_team_id)
            if r.DraftSchedule.from_team_id
            else None,
            scheduled_time=r.DraftSchedule.scheduled_at.isoformat(),
        )
        for r in rows
    ]


@router.get("/schedule", response_model=DraftScheduleResponse)
async def get_draft_schedule(
    db: Annotated[AsyncSession, Depends(get_db)],
    league: Annotated[League | None, Depends(get_optional_league)],
) -> DraftScheduleResponse:
    """Get upcoming draft picks for the current team's league."""
    if league is None:
        raise HTTPException(status_code=404, detail="No league context available")

    picks = await _build_schedule_items(db, league.id)
    cooldown = get_draft_cooldown(league.id)

    return DraftScheduleResponse(
        league_id=league.id,
        draft_complete=league.draft_complete,
        last_scraped_at=cooldown.isoformat() if cooldown else None,
        picks=picks,
    )


@router.post("/refresh", response_model=DraftRefreshResponse)
@limiter.limit("5/minute")
async def refresh_draft(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    league: Annotated[League | None, Depends(get_optional_league)],
) -> DraftRefreshResponse:
    """Trigger a draft scrape (respects 30-min cooldown)."""
    if league is None:
        raise HTTPException(status_code=404, detail="No league context available")

    try:
        summary = await scrape_and_persist_draft(db, league)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error fetching draft data: {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error fetching draft data: {e}",
        )

    # Re-fetch league to get updated draft_complete
    await db.refresh(league)
    picks = await _build_schedule_items(db, league.id)
    cooldown = get_draft_cooldown(league.id)

    return DraftRefreshResponse(
        league_id=league.id,
        draft_complete=league.draft_complete,
        last_scraped_at=cooldown.isoformat() if cooldown else None,
        picks=picks,
        upcoming_picks=summary["upcoming_picks"],
        completed_picks_processed=summary["completed_picks_processed"],
        players_rostered=summary["players_rostered"],
        unresolved_players=summary["unresolved_players"],
        cooldown_skipped=summary["cooldown_skipped"],
    )
