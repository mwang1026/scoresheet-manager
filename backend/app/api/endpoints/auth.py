"""Auth endpoints — email allowlist check for NextAuth.js signIn callback."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from posthog import capture, identify_context, new_context
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

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
    allowed = user is not None
    logger.info("Email check: %s -> allowed=%s", body.email, allowed)

    if allowed and user is not None:
        with new_context():
            identify_context(str(user.id))
            capture("user_signed_in")
    else:
        with new_context():
            identify_context("anonymous")
            capture("user_sign_in_denied")

    return EmailCheckResponse(allowed=allowed)
