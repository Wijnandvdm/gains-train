import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from pydantic import SecretStr
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, create_async_engine

from app.auth import SESSION_COOKIE, create_session_token
from app.config import settings
from app.db import get_session
from app.main import app
from app.models import User

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Tests must not depend on (or leak) the developer's .env secrets.
settings.session_secret = SecretStr("test-session-secret-not-used-anywhere-else-0123456789")
settings.google_client_id = "test-client-id.apps.googleusercontent.com"
settings.allowed_emails = ""
TEST_DB_URL = make_url(settings.database_url).set(
    database=f"{make_url(settings.database_url).database}_test"
)


async def _recreate_test_database() -> None:
    admin = create_async_engine(TEST_DB_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        await conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_URL.database}" WITH (FORCE)'))
        await conn.execute(text(f'CREATE DATABASE "{TEST_DB_URL.database}"'))
    await admin.dispose()


@pytest.fixture(scope="session")
async def db_connection() -> AsyncIterator[AsyncConnection]:
    """A fresh test database with all migrations applied (so migrations are tested too)."""
    await _recreate_test_database()
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", TEST_DB_URL.render_as_string(hide_password=False))
    # Alembic's env.py calls asyncio.run(), which can't nest inside the test loop.
    await asyncio.to_thread(command.upgrade, cfg, "head")

    engine = create_async_engine(TEST_DB_URL)
    async with engine.connect() as conn:
        yield conn
    await engine.dispose()


@pytest.fixture
async def session(db_connection: AsyncConnection) -> AsyncIterator[AsyncSession]:
    """A session whose changes are rolled back after each test.

    Commits inside the test only release a savepoint, so tests stay isolated.
    """
    trans = await db_connection.begin()
    s = AsyncSession(
        bind=db_connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    try:
        yield s
    finally:
        await s.close()
        await trans.rollback()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    """HTTP client for the API, whose requests use the test's (rolled back) session."""

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def create_user(session: AsyncSession, email: str = "me@example.com") -> User:
    user = User(email=email)
    session.add(user)
    await session.flush()
    return user


def sign_in(client: httpx.AsyncClient, user: User) -> None:
    """Make the client's requests come from `user` (as if they'd signed in with Google)."""
    client.cookies.set(SESSION_COOKIE, create_session_token(user.id))


@pytest.fixture
async def user(session: AsyncSession) -> User:
    return await create_user(session)


@pytest.fixture
async def auth_client(client: httpx.AsyncClient, user: User) -> httpx.AsyncClient:
    """The API client, signed in as `user`."""
    sign_in(client, user)
    return client
