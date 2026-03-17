"""Draft notes API endpoints — single note per team."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from posthog import capture, identify_context, new_context
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_team, get_current_user
from app.database import get_db
from app.models import Team, User
from app.models.draft_note import DraftNote
from app.schemas.draft_note import (
    DraftNoteResponse,
    DraftNoteUpsertRequest,
)

router = APIRouter(prefix="/api/draft", tags=["draft-notes"])


@router.get("/notes", response_model=DraftNoteResponse | None)
async def get_draft_note(
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> DraftNoteResponse | None:
    """Get the team's draft note, or null if none exists."""
    result = await db.execute(
        select(DraftNote).where(DraftNote.team_id == team.id)
    )
    note = result.scalars().first()
    if note is None:
        return None
    return DraftNoteResponse.model_validate(note)


@router.put("/notes", response_model=None)
async def upsert_draft_note(
    request: DraftNoteUpsertRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
    user: Annotated[User, Depends(get_current_user)],
) -> DraftNoteResponse | Response:
    """Upsert the team's draft note. Empty/whitespace content deletes."""
    content = request.content.strip()

    result = await db.execute(
        select(DraftNote).where(DraftNote.team_id == team.id)
    )
    note = result.scalars().first()

    # Empty content → delete
    if not content:
        if note is not None:
            await db.delete(note)
            await db.commit()
            with new_context():
                identify_context(str(user.id))
                capture("draft_note_deleted")
        return Response(status_code=204)

    # Create or update
    now = datetime.now(timezone.utc)
    is_new = note is None
    if note is None:
        note = DraftNote(
            team_id=team.id,
            content=content,
        )
        db.add(note)
    else:
        note.content = content
        note.updated_at = now

    await db.commit()
    await db.refresh(note)

    with new_context():
        identify_context(str(user.id))
        capture("draft_note_saved", properties={"is_new": is_new, "note_length": len(content)})

    return DraftNoteResponse.model_validate(note)
