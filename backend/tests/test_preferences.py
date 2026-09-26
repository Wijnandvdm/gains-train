import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.importers.free_exercise_db import seed_library
from app.models import Exercise, User
from tests.conftest import create_user, sign_in
from tests.test_exercise_library import LIBRARY


@pytest.fixture(autouse=True)
async def library(session: AsyncSession) -> None:
    await seed_library(session, LIBRARY)


async def ex(session: AsyncSession, slug: str = "Seated_Leg_Curl") -> int:
    ex_id = await session.scalar(select(Exercise.id).where(Exercise.slug == slug))
    assert ex_id is not None
    return ex_id


async def test_rest_settings_on_me(auth_client: httpx.AsyncClient) -> None:
    me = (await auth_client.get("/api/me")).json()
    assert (me["rest_timer_enabled"], me["default_rest_seconds"]) == (True, 90)

    r = await auth_client.patch("/api/me", json={"rest_timer_enabled": False})
    assert (r.json()["rest_timer_enabled"], r.json()["default_rest_seconds"]) == (False, 90)
    r = await auth_client.patch("/api/me", json={"default_rest_seconds": 120})
    assert (r.json()["rest_timer_enabled"], r.json()["default_rest_seconds"]) == (False, 120)

    for bad in (10, 601):
        assert (
            await auth_client.patch("/api/me", json={"default_rest_seconds": bad})
        ).status_code == 422


async def test_per_exercise_rest(auth_client: httpx.AsyncClient, session: AsyncSession) -> None:
    curl = await ex(session)
    assert (await auth_client.get("/api/exercise-preferences")).json() == []

    r = await auth_client.put(f"/api/exercise-preferences/{curl}", json={"rest_seconds": 180})
    assert r.json() == {"exercise_id": curl, "rest_seconds": 180}
    await auth_client.put(f"/api/exercise-preferences/{curl}", json={"rest_seconds": 0})  # no timer
    assert (await auth_client.get("/api/exercise-preferences")).json() == [
        {"exercise_id": curl, "rest_seconds": 0}
    ]

    assert (await auth_client.delete(f"/api/exercise-preferences/{curl}")).status_code == 204
    assert (await auth_client.delete(f"/api/exercise-preferences/{curl}")).status_code == 204
    assert (await auth_client.get("/api/exercise-preferences")).json() == []


async def test_rest_validation_and_visibility(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    curl = await ex(session)
    for bad in (-1, 901):
        r = await auth_client.put(f"/api/exercise-preferences/{curl}", json={"rest_seconds": bad})
        assert r.status_code == 422
    other = await create_user(session, "other@example.com")
    theirs = Exercise(slug="custom-theirs", name="Their Squat", owner_id=other.id)
    session.add(theirs)
    await session.flush()
    for exercise_id in (theirs.id, 999999):
        r = await auth_client.put(
            f"/api/exercise-preferences/{exercise_id}", json={"rest_seconds": 60}
        )
        assert r.status_code == 404


async def test_preferences_are_per_user(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    curl = await ex(session)
    await auth_client.put(f"/api/exercise-preferences/{curl}", json={"rest_seconds": 240})
    sign_in(auth_client, await create_user(session, "friend@example.com"))
    assert (await auth_client.get("/api/exercise-preferences")).json() == []
    await auth_client.delete(f"/api/exercise-preferences/{curl}")  # can't touch mine
    sign_in(auth_client, user)
    assert (await auth_client.get("/api/exercise-preferences")).json()[0]["rest_seconds"] == 240


async def test_requires_sign_in(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/exercise-preferences")).status_code == 401
