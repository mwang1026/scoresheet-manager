"""Player API endpoints."""

import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_optional_league
from app.database import get_db
from app.models import League, Player, PlayerPosition, PlayerRoster, RosterStatus
from app.schemas.player import PlayerDetail, PlayerListItem, PlayerListResponse

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("", response_model=PlayerListResponse)
async def list_players(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=2000, description="Items per page"),
    position: str | None = Query(None, description="Filter by primary position"),
    team: str | None = Query(None, description="Filter by current MLB team"),
    db: AsyncSession = Depends(get_db),
    league: League | None = Depends(get_optional_league),
) -> PlayerListResponse:
    """
    List Scoresheet league players (paginated).

    IMPORTANT: Only returns players with scoresheet_id (league-eligible players).
    PECOTA-only players are excluded.

    Returns enriched data including:
    - Computed name (first_name + last_name)
    - Position eligibility ratings from player_positions
    - Fantasy team_id from player_roster (if rostered)
    - Batting splits and catcher steal rates
    """
    # Build base query - FILTER TO SCORESHEET PLAYERS ONLY
    query = select(Player).where(Player.scoresheet_only())

    # Apply league eligibility filter based on scoresheet_id ranges
    # AL players: scoresheet_id < 1000 OR 4000 <= scoresheet_id < 5000
    # NL players: 1000 <= scoresheet_id < 2000 OR 5000 <= scoresheet_id < 6000
    if league and league.league_type in ("AL", "NL"):
        if league.league_type == "AL":
            home_range = or_(
                Player.scoresheet_id < 1000,
                and_(Player.scoresheet_id >= 4000, Player.scoresheet_id < 5000),
            )
            away_range = or_(
                and_(Player.scoresheet_id >= 1000, Player.scoresheet_id < 2000),
                and_(Player.scoresheet_id >= 5000, Player.scoresheet_id < 6000),
            )
        else:  # NL
            home_range = or_(
                and_(Player.scoresheet_id >= 1000, Player.scoresheet_id < 2000),
                and_(Player.scoresheet_id >= 5000, Player.scoresheet_id < 6000),
            )
            away_range = or_(
                Player.scoresheet_id < 1000,
                and_(Player.scoresheet_id >= 4000, Player.scoresheet_id < 5000),
            )

        # Away-range players are only eligible if rostered in this league
        rostered_subquery = (
            select(PlayerRoster.player_id)
            .where(PlayerRoster.status == RosterStatus.ROSTERED)
            .scalar_subquery()
        )
        query = query.where(
            or_(home_range, and_(away_range, Player.id.in_(rostered_subquery)))
        )

    # Apply filters
    if position:
        query = query.where(Player.primary_position == position)
    if team:
        query = query.where(Player.current_mlb_team == team)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(Player.last_name, Player.first_name).offset(offset).limit(page_size)

    # Execute query
    result = await db.execute(query)
    players = result.scalars().all()

    # Get player IDs for batch loading positions and roster info
    player_ids = [p.id for p in players]

    # Batch load positions
    positions_query = select(PlayerPosition).where(PlayerPosition.player_id.in_(player_ids))
    positions_result = await db.execute(positions_query)
    all_positions = positions_result.scalars().all()

    # Build position eligibility map: player_id -> {position: rating}
    position_map = {}
    for pos in all_positions:
        if pos.player_id not in position_map:
            position_map[pos.player_id] = {}
        position_map[pos.player_id][pos.position] = float(pos.rating)

    # Batch load roster info (for team_id)
    roster_query = (
        select(PlayerRoster)
        .where(PlayerRoster.player_id.in_(player_ids))
        .where(PlayerRoster.status == RosterStatus.ROSTERED)
    )
    roster_result = await db.execute(roster_query)
    roster_entries = roster_result.scalars().all()

    # Build team_id map: player_id -> team_id
    team_map = {r.player_id: r.team_id for r in roster_entries}

    # Build enriched PlayerListItem objects
    enriched_players = []
    for p in players:
        positions = position_map.get(p.id, {})
        player_dict = {
            "id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "name": f"{p.first_name} {p.last_name}",
            "scoresheet_id": p.scoresheet_id,
            "mlb_id": p.mlb_id,
            "primary_position": p.primary_position,
            "current_mlb_team": p.current_mlb_team,
            "current_team": p.current_mlb_team,  # Alias
            "bats": p.bats,
            "hand": p.bats,  # Alias
            "throws": p.throws,
            "age": p.age,
            "team_id": team_map.get(p.id),
            "eligible_1b": positions.get("1B"),
            "eligible_2b": positions.get("2B"),
            "eligible_3b": positions.get("3B"),
            "eligible_ss": positions.get("SS"),
            "eligible_of": positions.get("OF"),
            "osb_al": float(p.osb_al) if p.osb_al else None,
            "ocs_al": float(p.ocs_al) if p.ocs_al else None,
            "ba_vr": p.ba_vr,
            "ob_vr": p.ob_vr,
            "sl_vr": p.sl_vr,
            "ba_vl": p.ba_vl,
            "ob_vl": p.ob_vl,
            "sl_vl": p.sl_vl,
        }
        enriched_players.append(PlayerListItem(**player_dict))

    # Calculate total pages
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PlayerListResponse(
        players=enriched_players,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{player_id}", response_model=PlayerDetail)
async def get_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
) -> PlayerDetail:
    """
    Get detailed player information.

    Includes defensive positions, catcher steal rates, and batting splits.
    """
    # Get player
    query = select(Player).where(Player.id == player_id)
    result = await db.execute(query)
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Load positions separately
    positions_query = select(PlayerPosition).where(PlayerPosition.player_id == player_id)
    positions_result = await db.execute(positions_query)
    positions = positions_result.scalars().all()

    # Build response
    player_dict = {
        "id": player.id,
        "first_name": player.first_name,
        "last_name": player.last_name,
        "scoresheet_id": player.scoresheet_id,
        "mlb_id": player.mlb_id,
        "bp_id": player.bp_id,
        "scoresheet_nl_id": player.scoresheet_nl_id,
        "primary_position": player.primary_position,
        "bats": player.bats,
        "throws": player.throws,
        "age": player.age,
        "birthday": player.birthday,
        "height": player.height,
        "weight": player.weight,
        "current_mlb_team": player.current_mlb_team,
        "is_trade_bait": player.is_trade_bait,
        "positions": [{"position": p.position, "rating": p.rating} for p in positions],
        "osb_al": player.osb_al,
        "ocs_al": player.ocs_al,
        "osb_nl": player.osb_nl,
        "ocs_nl": player.ocs_nl,
        "ba_vr": player.ba_vr,
        "ob_vr": player.ob_vr,
        "sl_vr": player.sl_vr,
        "ba_vl": player.ba_vl,
        "ob_vl": player.ob_vl,
        "sl_vl": player.sl_vl,
    }

    return PlayerDetail(**player_dict)
