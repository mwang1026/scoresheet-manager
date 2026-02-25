"""Projections API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import HitterProjection, PitcherProjection, Player
from app.schemas.projection import (
    HitterProjectionAdvanced,
    HitterProjectionItem,
    PitcherProjectionAdvanced,
    PitcherProjectionItem,
    ProjectionListResponse,
)

router = APIRouter(prefix="/api/projections", tags=["projections"])


@router.get("", response_model=ProjectionListResponse)
async def list_projections(
    source: str | None = Query(None, description="Filter by projection source (e.g., PECOTA-50)"),
    player_id: int | None = Query(None, description="Filter by player ID"),
    season: int = Query(settings.SEED_LEAGUE_SEASON, description="Season year"),
    db: AsyncSession = Depends(get_db),
) -> ProjectionListResponse:
    """
    Get projections for both hitters and pitchers.

    IMPORTANT: Only returns projections for Scoresheet league players (players with scoresheet_id).

    Returns all projection sources by default to populate the source dropdown.
    Use ?source= to filter to a specific projection system.

    Args:
        source: Optional projection source filter (e.g., "PECOTA-50", "PECOTA-10", "PECOTA-90")
        player_id: Optional filter for single player
        season: Season year (defaults to 2026)
    """
    # Query hitter projections
    hitter_query = (
        select(HitterProjection)
        .join(Player, HitterProjection.player_id == Player.id)
        .where(Player.scoresheet_only())
        .where(HitterProjection.season == season)
    )

    if source:
        hitter_query = hitter_query.where(HitterProjection.source == source)
    if player_id is not None:
        hitter_query = hitter_query.where(HitterProjection.player_id == player_id)

    hitter_query = hitter_query.order_by(HitterProjection.player_id)

    # Query pitcher projections
    pitcher_query = (
        select(PitcherProjection)
        .join(Player, PitcherProjection.player_id == Player.id)
        .where(Player.scoresheet_only())
        .where(PitcherProjection.season == season)
    )

    if source:
        pitcher_query = pitcher_query.where(PitcherProjection.source == source)
    if player_id is not None:
        pitcher_query = pitcher_query.where(PitcherProjection.player_id == player_id)

    pitcher_query = pitcher_query.order_by(PitcherProjection.player_id)

    # Execute queries
    hitter_result = await db.execute(hitter_query)
    pitcher_result = await db.execute(pitcher_query)

    hitters = hitter_result.scalars().all()
    pitchers = pitcher_result.scalars().all()

    # Transform hitter projections
    hitter_items = []
    for h in hitters:
        # Build advanced metrics if any exist
        advanced = None
        if any(
            [
                h.avg is not None,
                h.obp is not None,
                h.slg is not None,
                h.babip is not None,
                h.drc_plus is not None,
                h.vorp is not None,
                h.warp is not None,
            ]
        ):
            advanced = HitterProjectionAdvanced(
                avg=float(h.avg) if h.avg is not None else None,
                obp=float(h.obp) if h.obp is not None else None,
                slg=float(h.slg) if h.slg is not None else None,
                babip=float(h.babip) if h.babip is not None else None,
                drc_plus=h.drc_plus,
                vorp=float(h.vorp) if h.vorp is not None else None,
                warp=float(h.warp) if h.warp is not None else None,
            )

        hitter_items.append(
            HitterProjectionItem(
                player_id=h.player_id,
                source=h.source,
                season=h.season,
                g=h.g,
                pa=h.pa,
                ab=h.ab,
                r=h.r,
                h=h.h,
                single=h.b1,  # Map b1 -> single
                double=h.b2,  # Map b2 -> double
                triple=h.b3,  # Map b3 -> triple
                hr=h.hr,
                rbi=h.rbi,
                bb=h.bb,
                ibb=0,  # Not in DB
                so=h.so,
                hbp=h.hbp,
                sf=0,  # Not in DB
                sh=0,  # Not in DB
                sb=h.sb,
                cs=h.cs,
                go=0,  # Not in DB
                fo=0,  # Not in DB
                gdp=0,  # Not in DB
                advanced=advanced,
            )
        )

    # Transform pitcher projections
    pitcher_items = []
    for p in pitchers:
        # Back-calculate ER from ERA and IP
        er = 0
        if p.era is not None and p.ip_outs > 0:
            ip = p.ip_outs / 3
            er = round(float(p.era) * ip / 9)

        # Build advanced metrics if any exist
        advanced = None
        if any(
            [
                p.era is not None,
                p.whip is not None,
                p.fip is not None,
                p.dra is not None,
                p.dra_minus is not None,
                p.warp is not None,
                p.gb_percent is not None,
            ]
        ):
            advanced = PitcherProjectionAdvanced(
                era=float(p.era) if p.era is not None else None,
                whip=float(p.whip) if p.whip is not None else None,
                fip=float(p.fip) if p.fip is not None else None,
                dra=float(p.dra) if p.dra is not None else None,
                dra_minus=p.dra_minus,
                warp=float(p.warp) if p.warp is not None else None,
                gb_percent=float(p.gb_percent) if p.gb_percent is not None else None,
            )

        pitcher_items.append(
            PitcherProjectionItem(
                player_id=p.player_id,
                source=p.source,
                season=p.season,
                g=p.g,
                gs=p.gs,
                gf=0,  # Not in DB
                cg=0,  # Not in DB
                sho=0,  # Not in DB
                w=p.w,
                l=p.l,
                sv=p.sv,
                hld=p.hld,
                ip_outs=p.ip_outs,
                h=p.h,
                r=0,  # Not in DB
                er=er,  # Back-calculated from ERA
                hr=p.hr,
                bb=p.bb,
                ibb=0,  # Not in DB
                so=p.so,
                hbp=p.hbp,
                wp=0,  # Not in DB
                bk=0,  # Not in DB
                advanced=advanced,
            )
        )

    # Combine and return
    all_projections = hitter_items + pitcher_items
    return ProjectionListResponse(projections=all_projections)
