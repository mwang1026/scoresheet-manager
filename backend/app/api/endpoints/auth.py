"""Auth endpoints — email allowlist check for NextAuth.js signIn callback."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class EmailCheckRequest(BaseModel):
    email: str


class EmailCheckResponse(BaseModel):
    allowed: bool


@router.post("/check-email", response_model=EmailCheckResponse)
async def check_email(
    body: EmailCheckRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EmailCheckResponse:
    """Check whether an email address is in the users table (allowlist).

    Called by the NextAuth.js signIn callback with X-Internal-API-Key.
    Returns allowed=true if the email exists, allowed=false otherwise.
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    return EmailCheckResponse(allowed=user is not None)
