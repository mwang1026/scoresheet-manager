"""Player notes API endpoints."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_team
from app.database import get_db
from app.models import Team
from app.models.player_note import PlayerNote
from app.schemas.player_note import (
    PlayerNoteCreateRequest,
    PlayerNoteListResponse,
    PlayerNoteResponse,
    PlayerNoteUpdateRequest,
)

router = APIRouter(prefix="/api/players", tags=["player-notes"])


@router.get("/{player_id}/notes", response_model=PlayerNoteListResponse)
async def list_notes(
    player_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> PlayerNoteListResponse:
    """List all notes for a player, scoped to the current team, newest first."""
    result = await db.execute(
        select(PlayerNote)
        .where(PlayerNote.team_id == team.id, PlayerNote.player_id == player_id)
        .order_by(PlayerNote.created_at.desc())
    )
    notes = result.scalars().all()
    return PlayerNoteListResponse(notes=[PlayerNoteResponse.model_validate(n) for n in notes])


@router.post("/{player_id}/notes", response_model=PlayerNoteResponse, status_code=201)
async def create_note(
    player_id: int,
    request: PlayerNoteCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> PlayerNoteResponse:
    """Create a new note for a player, scoped to the current team."""
    note = PlayerNote(
        team_id=team.id,
        player_id=player_id,
        content=request.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return PlayerNoteResponse.model_validate(note)


@router.put("/{player_id}/notes/{note_id}", response_model=PlayerNoteResponse)
async def update_note(
    player_id: int,
    note_id: int,
    request: PlayerNoteUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> PlayerNoteResponse:
    """Update a note's content. Returns 404 if not found or owned by another team."""
    result = await db.execute(
        select(PlayerNote).where(
            PlayerNote.id == note_id,
            PlayerNote.team_id == team.id,
            PlayerNote.player_id == player_id,
        )
    )
    note = result.scalars().first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    note.content = request.content
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return PlayerNoteResponse.model_validate(note)


@router.delete("/{player_id}/notes/{note_id}", status_code=204)
async def delete_note(
    player_id: int,
    note_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> Response:
    """Delete a note. Returns 404 if not found or owned by another team."""
    result = await db.execute(
        select(PlayerNote).where(
            PlayerNote.id == note_id,
            PlayerNote.team_id == team.id,
            PlayerNote.player_id == player_id,
        )
    )
    note = result.scalars().first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
    await db.commit()
    return Response(status_code=204)
