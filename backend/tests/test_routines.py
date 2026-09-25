import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.importers.free_exercise_db import seed_library
from app.models import Exercise, User, Workout, WorkoutStatus
from tests.conftest import create_user, sign_in
from tests.test_exercise_library import LIBRARY
from tests.test_workouts import make_workout


@pytest.fixture(autouse=True)
async def library(session: AsyncSession) -> None:
    await seed_library(session, LIBRARY)


async def ex(session: AsyncSession, slug: str) -> int:
    ex_id = await session.scalar(select(Exercise.id).where(Exercise.slug == slug))
    assert ex_id is not None
    return ex_id


def work_sets(n: int) -> list[dict[str, Any]]:
    return [{"weight_kg": Decimal("50"), "reps": 10} for _ in range(n)]


async def legacy_split(session: AsyncSession, user: User) -> None:
    """Day1/Day2/Day10 workouts (Day10 checks natural sorting), Day2 done most recently."""
    curl, rdl, lying = (
        await ex(session, "Seated_Leg_Curl"),
        await ex(session, "Romanian_Deadlift"),
        await ex(session, "Lying_Leg_Curls"),
    )
    for day, name, exercise, n_sets in [
        (date(2026, 9, 1), "Day1 · Legs", curl, 2),
        (date(2026, 9, 2), "Day2 · Back", rdl, 3),
        (date(2026, 9, 3), "Day10 · Extra", lying, 1),
        (date(2026, 9, 8), "Day1 · Legs", curl, 3),  # newer Day1: 3 sets now
        (date(2026, 9, 9), "Day2 · Back", rdl, 3),
    ]:
        await make_workout(session, user, exercise, day, work_sets(n_sets), name=name)
    await make_workout(session, user, curl, date(2026, 9, 10), work_sets(1))  # unnamed


async def test_routine_from_history(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    await legacy_split(session, user)

    r = await auth_client.post("/api/routine/from-history")
    assert r.status_code == 200, r.text
    routine = r.json()
    days = routine["days"]
    assert [d["name"] for d in days] == ["Day1 · Legs", "Day2 · Back", "Day10 · Extra"]
    assert [(e["exercise"]["name"], e["sets"]) for e in days[0]["exercises"]] == [
        ("Seated Leg Curl", 3)  # from the most recent Day1
    ]
    # Day2 was done last, so Day10 is up next.
    assert routine["next_day_id"] == days[2]["id"]

    # Past workouts are linked to their day.
    linked = {
        w.name: w.routine_day_id
        for w in await session.scalars(select(Workout).where(Workout.name.is_not(None)))
    }
    assert str(linked["Day2 · Back"]) == days[1]["id"]


async def test_from_history_needs_named_workouts(auth_client: httpx.AsyncClient) -> None:
    assert (await auth_client.post("/api/routine/from-history")).status_code == 422


async def test_next_day_rotates_and_wraps(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    curl = await ex(session, "Seated_Leg_Curl")
    body = {
        "days": [
            {"name": "A", "exercises": [{"exercise_id": curl, "sets": 3}]},
            {"name": "B", "exercises": []},
        ]
    }
    routine = (await auth_client.put("/api/routine", json=body)).json()
    a, b = (d["id"] for d in routine["days"])
    assert routine["next_day_id"] == a  # nothing done yet: start at the top

    async def do(day_id: str) -> str:
        w = (await auth_client.post("/api/workouts", json={"routine_day_id": day_id})).json()
        await auth_client.post(f"/api/workouts/{w['id']}/finish", json={})
        next_day: str = (await auth_client.get("/api/routine")).json()["next_day_id"]
        return next_day

    assert await do(a) == b
    assert await do(b) == a  # wraps around
    # An unfinished workout doesn't move the rotation.
    await auth_client.post("/api/workouts", json={"routine_day_id": a})
    assert (await auth_client.get("/api/routine")).json()["next_day_id"] == a


async def test_editing_keeps_day_ids_and_the_rotation(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    curl, rdl = await ex(session, "Seated_Leg_Curl"), await ex(session, "Romanian_Deadlift")
    routine = (
        await auth_client.put(
            "/api/routine", json={"days": [{"name": "A"}, {"name": "B"}, {"name": "C"}]}
        )
    ).json()
    a, b, c = (d["id"] for d in routine["days"])
    w = (await auth_client.post("/api/workouts", json={"routine_day_id": a})).json()
    await auth_client.post(f"/api/workouts/{w['id']}/finish", json={})

    # Rename A, give it exercises, move C first, drop B, add D.
    r = await auth_client.put(
        "/api/routine",
        json={
            "days": [
                {"id": c, "name": "C"},
                {
                    "id": a,
                    "name": "A (legs)",
                    "exercises": [
                        {"exercise_id": rdl, "sets": 4},
                        {"exercise_id": curl},
                    ],
                },
                {"name": "D"},
            ]
        },
    )
    assert r.status_code == 200, r.text
    days = r.json()["days"]
    assert [(d["id"], d["name"], d["position"]) for d in days[:2]] == [
        (c, "C", 1),
        (a, "A (legs)", 2),
    ]
    assert [(e["exercise"]["name"], e["sets"]) for e in days[1]["exercises"]] == [
        ("Romanian Deadlift", 4),
        ("Seated Leg Curl", 3),  # default
    ]
    assert b not in [d["id"] for d in days]
    # A was done last and is still linked, so D (after A) is next.
    assert r.json()["next_day_id"] == days[2]["id"]
    workout = await session.get(Workout, uuid.UUID(w["id"]))
    assert workout is not None and str(workout.routine_day_id) == a


async def test_routine_validation_and_isolation(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    other = await create_user(session, "other@example.com")
    theirs = Exercise(slug="custom-theirs", name="Their Squat", owner_id=other.id)
    session.add(theirs)
    await session.flush()

    assert (await auth_client.put("/api/routine", json={"days": []})).status_code == 422
    bad_sets = {"days": [{"name": "A", "exercises": [{"exercise_id": theirs.id, "sets": 0}]}]}
    assert (await auth_client.put("/api/routine", json=bad_sets)).status_code == 422
    foreign = {"days": [{"name": "A", "exercises": [{"exercise_id": theirs.id}]}]}
    assert (await auth_client.put("/api/routine", json=foreign)).status_code == 404

    mine = (await auth_client.put("/api/routine", json={"days": [{"name": "A"}]})).json()
    my_day = mine["days"][0]["id"]

    sign_in(auth_client, other)
    assert (await auth_client.get("/api/routine")).json() is None
    # Can't start a workout on someone else's routine day…
    r = await auth_client.post("/api/workouts", json={"routine_day_id": my_day})
    assert r.status_code == 404
    # …or hijack its id when saving your own routine (it becomes a new day).
    theirs_routine = (
        await auth_client.put("/api/routine", json={"days": [{"id": my_day, "name": "X"}]})
    ).json()
    assert theirs_routine["days"][0]["id"] != my_day

    sign_in(auth_client, user)
    assert (await auth_client.get("/api/routine")).json()["days"][0]["name"] == "A"


async def test_delete_routine_keeps_workouts(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    await legacy_split(session, user)
    await auth_client.post("/api/routine/from-history")
    assert (await auth_client.delete("/api/routine")).status_code == 204
    assert (await auth_client.get("/api/routine")).json() is None
    # populate_existing: re-read rows the session already holds (the DB set them to NULL).
    workouts = (
        await session.scalars(select(Workout).execution_options(populate_existing=True))
    ).all()
    assert len(workouts) == 6 and all(w.routine_day_id is None for w in workouts)


async def test_setup_flag(auth_client: httpx.AsyncClient) -> None:
    assert (await auth_client.get("/api/me")).json()["setup_completed_at"] is None
    r = await auth_client.patch("/api/me", json={"setup_completed": True})
    assert r.json()["setup_completed_at"] is not None
    assert (await auth_client.get("/api/me")).json()["setup_completed_at"] is not None


async def test_status_of_in_progress_routine_workout(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    routine = (await auth_client.put("/api/routine", json={"days": [{"name": "A"}]})).json()
    day = routine["days"][0]["id"]
    w = (await auth_client.post("/api/workouts", json={"routine_day_id": day})).json()
    assert w["routine_day_id"] == day
    assert w["status"] == WorkoutStatus.IN_PROGRESS
    listed = (await auth_client.get("/api/workouts")).json()["items"][0]
    assert listed["routine_day_id"] == day
