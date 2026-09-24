from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    CurrentUser,
    GoogleIdentity,
    GoogleVerifier,
    InvalidGoogleToken,
    clear_session_cookie,
    get_google_verifier,
    set_session_cookie,
)
from app.config import settings
from app.db import get_session
from app.models import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/api", tags=["auth"])


class AuthConfig(BaseModel):
    google_client_id: str


class GoogleLogin(BaseModel):
    credential: str  # the ID token from Google's sign-in button


@router.get("/auth/config", response_model=AuthConfig)
async def auth_config() -> AuthConfig:
    """Public settings the frontend needs to render the sign-in button."""
    return AuthConfig(google_client_id=settings.google_client_id)


async def _find_or_create_user(session: AsyncSession, identity: GoogleIdentity) -> User:
    user = await session.scalar(select(User).where(User.google_sub == identity.sub))
    if user is None:
        # First Google sign-in: link to an existing account with this email (e.g. one
        # created by the legacy import), or create a new one. Safe because Google has
        # verified the email address (checked by the caller).
        user = await session.scalar(select(User).where(User.email == identity.email))
        if user is None:
            user = User(email=identity.email)
            session.add(user)
        elif user.google_sub is not None:
            # This email belongs to a different Google account; don't take it over.
            raise HTTPException(status.HTTP_409_CONFLICT, "Email is linked to another account")
        user.google_sub = identity.sub
    # Keep profile details in sync with Google.
    user.email = identity.email
    user.name = identity.name
    user.avatar_url = identity.picture
    await session.commit()
    return user


@router.post("/auth/google", response_model=UserOut)
async def login_with_google(
    body: GoogleLogin,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    verify: Annotated[GoogleVerifier, Depends(get_google_verifier)],
) -> UserOut:
    try:
        identity = await verify(body.credential)
    except InvalidGoogleToken:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google sign-in") from None
    if not identity.email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Google email address is not verified")
    allowed = settings.allowed_email_set
    if allowed and identity.email not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not allowed to sign in")

    user = await _find_or_create_user(session, identity)
    set_session_cookie(response, user.id)
    return UserOut.model_validate(user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    clear_session_cookie(response)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
