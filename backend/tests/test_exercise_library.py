from typing import Any

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.importers.free_exercise_db import FreeExercise, seed_library
from app.models import Exercise, ExerciseMuscle, User


def free_exercise(id: str, name: str, **overrides: Any) -> FreeExercise:
    """A record shaped like the real exercises.json."""
    raw: dict[str, Any] = {
        "id": id,
        "name": name,
        "force": "pull",
        "level": "beginner",
        "mechanic": "isolation",
        "equipment": "machine",
        "category": "strength",
        "primaryMuscles": ["hamstrings"],
        "secondaryMuscles": [],
        "instructions": ["Sit down.", "Curl."],
        "images": [f"{id}/0.jpg", f"{id}/1.jpg"],
    }
    return FreeExercise.model_validate(raw | overrides)


LIBRARY = [
    free_exercise("Seated_Leg_Curl", "Seated Leg Curl"),
    free_exercise("Lying_Leg_Curls", "Lying Leg Curls"),
    free_exercise(
        "Incline_Dumbbell_Curl",
        "Incline Dumbbell Curl",
        equipment="dumbbell",
        primaryMuscles=["biceps"],
        secondaryMuscles=["forearms"],
    ),
    free_exercise(
        "Romanian_Deadlift",
        "Romanian Deadlift",
        equipment="barbell",
        mechanic="compound",
        primaryMuscles=["hamstrings"],
        secondaryMuscles=["glutes", "lower back"],
    ),
    free_exercise(
        "Curl_Bar_50%",  # odd characters, to check LIKE escaping
        "Curl 50% Test",
        equipment="e-z curl bar",
        primaryMuscles=["biceps"],
    ),
]


@pytest.fixture
async def library(session: AsyncSession) -> None:
    await seed_library(session, LIBRARY)
    await session.flush()


# --- Seeding ------------------------------------------------------------------------------


async def test_seed_is_idempotent_and_applies_updates(session: AsyncSession) -> None:
    await seed_library(session, LIBRARY)
    changed = [
        free_exercise("Seated_Leg_Curl", "Seated Leg Curl (renamed)", primaryMuscles=["calves"]),
        *LIBRARY[1:],
    ]
    stats = await seed_library(session, changed)

    assert stats.exercises == len(LIBRARY)
    assert await session.scalar(select(func.count()).select_from(Exercise)) == len(LIBRARY)
    curl = await session.scalar(select(Exercise).where(Exercise.slug == "Seated_Leg_Curl"))
    assert curl is not None
    assert curl.name == "Seated Leg Curl (renamed)"
    links = await session.scalar(
        select(func.count())
        .select_from(ExerciseMuscle)
        .where(ExerciseMuscle.exercise_id == curl.id)
    )
    assert links == 1  # old hamstrings link replaced by calves, not added to


async def test_seed_prefers_primary_when_muscle_listed_twice(session: AsyncSession) -> None:
    await seed_library(
        session,
        [free_exercise("X", "X", primaryMuscles=["biceps"], secondaryMuscles=["biceps"])],
    )
    await session.flush()
    link = await session.scalar(select(ExerciseMuscle))
    assert link is not None and link.role == "primary"


# --- API ----------------------------------------------------------------------------------


async def names(client: httpx.AsyncClient, **params: Any) -> list[str]:
    r = await client.get("/api/exercises", params=params)
    assert r.status_code == 200, r.text
    return [x["name"] for x in r.json()["items"]]


@pytest.mark.usefixtures("library")
async def test_list_returns_summaries_sorted_by_name(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/exercises")
    body = r.json()
    assert body["total"] == len(LIBRARY)
    assert [x["name"] for x in body["items"]] == sorted(e.name for e in LIBRARY)
    curl = next(x for x in body["items"] if x["slug"] == "Incline_Dumbbell_Curl")
    assert curl["primary_muscles"] == ["biceps"]
    assert curl["secondary_muscles"] == ["forearms"]
    assert curl["image_urls"] == [
        "/api/exercise-images/Incline_Dumbbell_Curl/0.jpg",
        "/api/exercise-images/Incline_Dumbbell_Curl/1.jpg",
    ]
    assert curl["is_custom"] is False
    assert "instructions" not in curl  # only in the detail view


@pytest.mark.usefixtures("library")
async def test_search_requires_every_word(client: httpx.AsyncClient) -> None:
    assert await names(client, q="leg curl") == ["Lying Leg Curls", "Seated Leg Curl"]
    assert await names(client, q="SEATED curl") == ["Seated Leg Curl"]
    assert await names(client, q="curl deadlift") == []


@pytest.mark.usefixtures("library")
async def test_search_ranks_names_starting_with_query_first(client: httpx.AsyncClient) -> None:
    assert (await names(client, q="curl"))[0] == "Curl 50% Test"


@pytest.mark.usefixtures("library")
async def test_search_treats_like_wildcards_literally(client: httpx.AsyncClient) -> None:
    assert await names(client, q="50%") == ["Curl 50% Test"]
    assert await names(client, q="%") == ["Curl 50% Test"]
    assert await names(client, q="_") == []


@pytest.mark.usefixtures("library")
async def test_filters(client: httpx.AsyncClient) -> None:
    # muscle= matches primary muscles only (Romanian Deadlift only works glutes secondarily)
    assert await names(client, muscle="glutes") == []
    assert await names(client, muscle="hamstrings", equipment="machine") == [
        "Lying Leg Curls",
        "Seated Leg Curl",
    ]
    assert await names(client, equipment="barbell") == ["Romanian Deadlift"]
    assert await names(client, category="stretching") == []


@pytest.mark.usefixtures("library")
async def test_pagination(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/exercises", params={"limit": 2, "offset": 2})
    body = r.json()
    assert (body["total"], body["limit"], body["offset"]) == (len(LIBRARY), 2, 2)
    assert [x["name"] for x in body["items"]] == sorted(e.name for e in LIBRARY)[2:4]
    assert (await client.get("/api/exercises", params={"limit": 101})).status_code == 422


@pytest.mark.usefixtures("library")
async def test_detail_includes_instructions(client: httpx.AsyncClient) -> None:
    listed = (await client.get("/api/exercises", params={"q": "romanian"})).json()["items"][0]
    r = await client.get(f"/api/exercises/{listed['id']}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["instructions"] == ["Sit down.", "Curl."]
    assert detail["secondary_muscles"] == ["glutes", "lower back"]
    assert (await client.get("/api/exercises/999999")).status_code == 404


@pytest.mark.usefixtures("library")
async def test_custom_exercises_are_hidden_from_other_users(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = User(email="owner@example.com")
    session.add(owner)
    await session.flush()
    custom = Exercise(slug="custom-abc", name="Bulgarian Split Squat", owner_id=owner.id)
    session.add(custom)
    await session.flush()

    # Anonymous for now (auth arrives in step 4): only library exercises are visible.
    assert "Bulgarian Split Squat" not in await names(client)
    assert (await client.get(f"/api/exercises/{custom.id}")).status_code == 404


@pytest.mark.usefixtures("library")
async def test_filter_values(client: httpx.AsyncClient) -> None:
    body = (await client.get("/api/exercises/filters")).json()
    assert body["equipment"] == ["barbell", "dumbbell", "e-z curl bar", "machine"]
    assert body["categories"] == ["strength"]
    assert body["muscles"] == ["biceps", "forearms", "glutes", "hamstrings", "lower back"]
