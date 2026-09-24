"""Authentication: Google sign-in → our own session cookie.

Flow:
1. The frontend shows Google's sign-in button and receives a signed Google ID token (a JWT).
2. It POSTs that token to /api/auth/google. We verify it against Google's public keys
   (signature, audience = our client ID, issuer, expiry) and find or create the user.
3. We set our own session cookie: a JWT signed with SESSION_SECRET holding the user id.
   It's httpOnly (JavaScript can't read it, so XSS can't steal it) and SameSite=Lax
   (browsers don't send it on cross-site POSTs, which blocks CSRF on state-changing requests).
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import jwt
from fastapi import Cookie, Depends, HTTPException, Response, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import User

SESSION_COOKIE = "gt_session"
_JWT_ALGORITHM = "HS256"


# --- Google ID tokens ---------------------------------------------------------------------


@dataclass
class GoogleIdentity:
    sub: str  # Google's stable account id; emails can change, this can't
    email: str
    email_verified: bool
    name: str | None
    picture: str | None


class InvalidGoogleToken(Exception):
    pass


def _verify_google_token_sync(credential: str) -> GoogleIdentity:
    if not settings.google_client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured")
    try:
        # Fetches Google's public keys and checks signature, audience, issuer and expiry.
        # google-auth ships without type hints for this function, hence the ignore.
        claims: dict[str, Any] = id_token.verify_oauth2_token(  # type: ignore[no-untyped-call]
            credential, google_requests.Request(), settings.google_client_id
        )
    except ValueError as e:
        raise InvalidGoogleToken(str(e)) from e
    return GoogleIdentity(
        sub=claims["sub"],
        email=claims["email"].lower(),
        email_verified=bool(claims.get("email_verified")),
        name=claims.get("name"),
        picture=claims.get("picture"),
    )


async def verify_google_token(credential: str) -> GoogleIdentity:
    # The Google library is synchronous (network call); keep it off the event loop.
    return await asyncio.to_thread(_verify_google_token_sync, credential)


GoogleVerifier = Callable[[str], Awaitable[GoogleIdentity]]


def get_google_verifier() -> GoogleVerifier:
    """A dependency, so tests can swap in a fake instead of calling Google."""
    return verify_google_token


# --- Session cookie -----------------------------------------------------------------------


def _secret() -> str:
    if settings.session_secret is None or not settings.session_secret.get_secret_value():
        raise RuntimeError("SESSION_SECRET is not configured")
    return settings.session_secret.get_secret_value()


def create_session_token(user_id: uuid.UUID, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(days=settings.session_days)}
    return jwt.encode(payload, _secret(), algorithm=_JWT_ALGORITHM)


def read_session_token(token: str) -> uuid.UUID | None:
    """The user id in a valid, unexpired token; None for anything else."""
    try:
        payload = jwt.decode(
            token, _secret(), algorithms=[_JWT_ALGORITHM], options={"require": ["exp", "sub"]}
        )
        return uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None


def set_session_cookie(response: Response, user_id: uuid.UUID) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user_id),
        max_age=settings.session_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        SESSION_COOKIE, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/"
    )


# --- Dependencies -------------------------------------------------------------------------

SessionCookie = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]


async def optional_user_id(gt_session: SessionCookie = None) -> uuid.UUID | None:
    """The signed-in user's id, or None. Doesn't hit the database."""
    return read_session_token(gt_session) if gt_session else None


async def current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    user_id: Annotated[uuid.UUID | None, Depends(optional_user_id)],
) -> User:
    """The signed-in user; responds 401 if there is none (or it no longer exists)."""
    user = await session.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


OptionalUserId = Annotated[uuid.UUID | None, Depends(optional_user_id)]
CurrentUser = Annotated[User, Depends(current_user)]
