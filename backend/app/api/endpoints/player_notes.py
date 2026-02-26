"""Player notes API endpoints — single-note-per-team-player."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_team
from app.database import get_db
from app.models import Team
from app.models.player_note import PlayerNote
from app.schemas.player_note import (
    PlayerNoteResponse,
    PlayerNoteUpsertRequest,
    TeamNotesResponse,
)

router = APIRouter(prefix="/api", tags=["player-notes"])


@router.get("/notes", response_model=TeamNotesResponse)
async def get_team_notes(
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> TeamNotesResponse:
    """Bulk fetch all notes for the current team as a player_id → content map."""
    result = await db.execute(
        select(PlayerNote).where(PlayerNote.team_id == team.id)
    )
    notes = result.scalars().all()
    return TeamNotesResponse(notes={n.player_id: n.content for n in notes})


@router.get("/players/{player_id}/note", response_model=PlayerNoteResponse | None)
async def get_player_note(
    player_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> PlayerNoteResponse | None:
    """Get the single note for a player, or null if none exists."""
    result = await db.execute(
        select(PlayerNote).where(
            PlayerNote.team_id == team.id,
            PlayerNote.player_id == player_id,
        )
    )
    note = result.scalars().first()
    if note is None:
        return None
    return PlayerNoteResponse.model_validate(note)


@router.put("/players/{player_id}/note", response_model=None)
async def upsert_player_note(
    player_id: int,
    request: PlayerNoteUpsertRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> PlayerNoteResponse | Response:
    """Upsert a player note. Empty/whitespace content deletes the note."""
    content = request.content.strip()

    result = await db.execute(
        select(PlayerNote).where(
            PlayerNote.team_id == team.id,
            PlayerNote.player_id == player_id,
        )
    )
    note = result.scalars().first()

    # Empty content → delete
    if not content:
        if note is not None:
            await db.delete(note)
            await db.commit()
        return Response(status_code=204)

    # Create or update
    now = datetime.now(timezone.utc)
    if note is None:
        note = PlayerNote(
            team_id=team.id,
            player_id=player_id,
            content=content,
        )
        db.add(note)
    else:
        note.content = content
        note.updated_at = now

    await db.commit()
    await db.refresh(note)
    return PlayerNoteResponse.model_validate(note)
