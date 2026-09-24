import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    SESSION_COOKIE,
    GoogleIdentity,
    InvalidGoogleToken,
    create_session_token,
    get_google_verifier,
    read_session_token,
)
from app.config import settings
from app.main import app
from app.models import Exercise, User

ME = GoogleIdentity(
    sub="google-sub-me",
    email="me@example.com",
    email_verified=True,
    name="Me",
    picture="https://example.com/me.png",
)


@pytest.fixture
def google_accounts() -> dict[str, GoogleIdentity]:
    """Fake Google: maps credential strings to identities."""
    return {"good-token": ME}


@pytest.fixture(autouse=True)
async def fake_google(google_accounts: dict[str, GoogleIdentity]) -> AsyncIterator[None]:
    async def verify(credential: str) -> GoogleIdentity:
        if credential not in google_accounts:
            raise InvalidGoogleToken("bad token")
        return google_accounts[credential]

    app.dependency_overrides[get_google_verifier] = lambda: verify
    yield
    app.dependency_overrides.pop(get_google_verifier, None)


async def login(client: httpx.AsyncClient, credential: str = "good-token") -> httpx.Response:
    return await client.post("/api/auth/google", json={"credential": credential})


# --- Session tokens -----------------------------------------------------------------------


def test_session_token_round_trip() -> None:
    user_id = uuid.uuid4()
    assert read_session_token(create_session_token(user_id)) == user_id


def test_expired_session_token_is_rejected() -> None:
    long_ago = datetime.now(UTC) - timedelta(days=settings.session_days + 1)
    assert read_session_token(create_session_token(uuid.uuid4(), now=long_ago)) is None


def test_tampered_or_foreign_tokens_are_rejected() -> None:
    token = create_session_token(uuid.uuid4())
    assert read_session_token(token[:-2] + "xx") is None
    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "exp": datetime.now(UTC) + timedelta(days=1)},
        "an-attacker-secret-that-is-long-enough-for-hs256",
        algorithm="HS256",
    )
    assert read_session_token(forged) is None
    unsigned = jwt.encode({"sub": str(uuid.uuid4())}, "", algorithm="none")
    assert read_session_token(unsigned) is None
    assert read_session_token("garbage") is None


def test_missing_session_secret_fails_loudly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "session_secret", SecretStr(""))
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        create_session_token(uuid.uuid4())


# --- Login flow ---------------------------------------------------------------------------


async def test_login_creates_user_and_sets_session_cookie(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    r = await login(client)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "me@example.com"
    assert r.json()["name"] == "Me"

    cookie = r.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie

    user = await session.scalar(select(User))
    assert user is not None and user.google_sub == "google-sub-me"

    me = await client.get("/api/me")  # httpx keeps the cookie, like a browser
    assert me.status_code == 200
    assert me.json()["id"] == str(user.id)


async def test_login_links_existing_account_by_email(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    # E.g. the account the legacy import created, before any Google sign-in.
    imported = User(email="me@example.com")
    session.add(imported)
    await session.flush()

    r = await login(client)
    assert r.json()["id"] == str(imported.id)
    assert await session.scalar(select(func.count()).select_from(User)) == 1
    assert imported.google_sub == "google-sub-me"


async def test_second_login_updates_profile_not_duplicate(
    client: httpx.AsyncClient, session: AsyncSession, google_accounts: dict[str, GoogleIdentity]
) -> None:
    await login(client)
    google_accounts["new-token"] = GoogleIdentity(
        sub=ME.sub, email="me@example.com", email_verified=True, name="New Name", picture=None
    )
    r = await login(client, "new-token")
    assert r.json()["name"] == "New Name"
    assert await session.scalar(select(func.count()).select_from(User)) == 1


async def test_invalid_google_token_is_rejected(client: httpx.AsyncClient) -> None:
    r = await login(client, "forged")
    assert r.status_code == 401
    assert "set-cookie" not in r.headers


async def test_unverified_email_is_rejected(
    client: httpx.AsyncClient, google_accounts: dict[str, GoogleIdentity]
) -> None:
    google_accounts["unverified"] = GoogleIdentity(
        sub="x", email="x@example.com", email_verified=False, name=None, picture=None
    )
    assert (await login(client, "unverified")).status_code == 403


async def test_email_owned_by_other_google_account_is_not_taken_over(
    client: httpx.AsyncClient, session: AsyncSession, google_accounts: dict[str, GoogleIdentity]
) -> None:
    session.add(User(email="me@example.com", google_sub="someone-else"))
    await session.flush()
    assert (await login(client)).status_code == 409


async def test_allowlist(
    client: httpx.AsyncClient,
    google_accounts: dict[str, GoogleIdentity],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "allowed_emails", "friend@example.com, ME@example.com")
    assert (await login(client)).status_code == 200

    google_accounts["stranger"] = GoogleIdentity(
        sub="s", email="stranger@example.com", email_verified=True, name=None, picture=None
    )
    assert (await login(client, "stranger")).status_code == 403


async def test_logout_clears_cookie(client: httpx.AsyncClient) -> None:
    await login(client)
    r = await client.post("/api/auth/logout")
    assert r.status_code == 204
    assert f'{SESSION_COOKIE}=""' in r.headers["set-cookie"]
    assert "Max-Age=0" in r.headers["set-cookie"]
    assert (await client.get("/api/me")).status_code == 401


async def test_me_requires_login(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/me")).status_code == 401
    client.cookies.set(SESSION_COOKIE, "garbage")
    assert (await client.get("/api/me")).status_code == 401


async def test_session_for_deleted_user_is_rejected(client: httpx.AsyncClient) -> None:
    client.cookies.set(SESSION_COOKIE, create_session_token(uuid.uuid4()))
    assert (await client.get("/api/me")).status_code == 401


async def test_auth_config_exposes_client_id(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "google_client_id", "abc.apps.googleusercontent.com")
    r = await client.get("/api/auth/config")
    assert r.json() == {"google_client_id": "abc.apps.googleusercontent.com"}


# --- Auth + exercises ---------------------------------------------------------------------


async def test_signed_in_user_sees_own_custom_exercises_only(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    await login(client)
    me = await session.scalar(select(User))
    other = User(email="other@example.com")
    session.add(other)
    await session.flush()
    assert me is not None
    session.add_all(
        [
            Exercise(slug="custom-mine", name="Bulgarian Split Squat", owner_id=me.id),
            Exercise(slug="custom-theirs", name="Secret Squat", owner_id=other.id),
        ]
    )
    await session.flush()

    body = (await client.get("/api/exercises", params={"q": "squat"})).json()
    assert [(x["name"], x["is_custom"]) for x in body["items"]] == [("Bulgarian Split Squat", True)]
