"""Centralized roster operations.

assign_to_roster() is the single entry point for incremental roster adds
(e.g., draft picks). The bulk scrape_and_persist_rosters() in the scraper
package keeps its own delete-and-replace approach for full syncs.
"""

import logging
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DraftQueue, PlayerRoster, RosterStatus, Team

logger = logging.getLogger(__name__)


async def assign_to_roster(
    session: AsyncSession,
    player_id: int,
    team_id: int,
    league_id: int,
    *,
    added_date: date | None = None,
) -> None:
    """Single entry point for all incremental roster adds.

    1. Upserts a PlayerRoster row with status=ROSTERED, keyed on
       (league_id, player_id) — if the player is already rostered in this
       league, their team_id is updated rather than a duplicate row inserted.
    2. Deletes DraftQueue entries for this player across ALL teams in the league.
    3. Does NOT remove from watchlists (watching a rostered player is valid).

    Caller is responsible for committing the transaction.
    """
    added = added_date or date.today()
    stmt = insert(PlayerRoster.__table__).values(
        player_id=player_id,
        team_id=team_id,
        league_id=league_id,
        status=RosterStatus.ROSTERED,
        added_date=added,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["league_id", "player_id"],
        set_={
            "team_id": team_id,
            "status": RosterStatus.ROSTERED,
            "added_date": added,
        },
    )
    await session.execute(stmt)

    # Remove from all draft queues in this league
    team_ids_result = await session.execute(
        select(Team.id).where(Team.league_id == league_id)
    )
    league_team_ids = [row[0] for row in team_ids_result.all()]

    if league_team_ids:
        deleted = await session.execute(
            delete(DraftQueue).where(
                DraftQueue.player_id == player_id,
                DraftQueue.team_id.in_(league_team_ids),
            )
        )
        if deleted.rowcount:
            logger.info(
                "Removed player %d from %d draft queue(s) in league %d",
                player_id,
                deleted.rowcount,
                league_id,
            )


async def check_player_rostered(
    session: AsyncSession,
    player_id: int,
    league_id: int,
) -> tuple[bool, str | None]:
    """Check if a player is rostered in the given league.

    Returns (is_rostered, owning_team_name).
    """
    result = await session.execute(
        select(PlayerRoster, Team.name)
        .join(Team, PlayerRoster.team_id == Team.id)
        .where(
            PlayerRoster.player_id == player_id,
            Team.league_id == league_id,
            PlayerRoster.status == RosterStatus.ROSTERED,
        )
        .limit(1)
    )
    row = result.first()
    if row is None:
        return (False, None)
    return (True, row[1])
