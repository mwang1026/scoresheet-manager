"""User settings API endpoints."""

import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.database import get_db
from app.models import User
from app.models.user_settings import UserSettings
from app.schemas.user_settings import UserSettingsResponse, UserSettingsUpdateRequest

router = APIRouter(prefix="/api/me", tags=["user-settings"])


@router.get("/settings", response_model=UserSettingsResponse | None)
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> UserSettingsResponse | None:
    """Return the current user's settings, or null if none saved yet."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return UserSettingsResponse.model_validate(row)


@router.put("/settings", response_model=UserSettingsResponse)
async def upsert_settings(
    request: UserSettingsUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> UserSettingsResponse:
    """Create or update the current user's settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    row = result.scalar_one_or_none()

    settings_str = json.dumps(request.settings_json)

    if row is None:
        row = UserSettings(
            user_id=user.id,
            settings_json=settings_str,
        )
        db.add(row)
    else:
        row.settings_json = settings_str
        row.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(row)
    return UserSettingsResponse.model_validate(row)
