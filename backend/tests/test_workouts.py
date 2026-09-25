import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.importers.free_exercise_db import seed_library
from app.models import Exercise, User, Workout, WorkoutExercise, WorkoutSet, WorkoutStatus
from tests.conftest import create_user, sign_in
from tests.test_exercise_library import LIBRARY


@pytest.fixture(autouse=True)
async def library(session: AsyncSession) -> None:
    await seed_library(session, LIBRARY)


async def exercise_id(session: AsyncSession, slug: str = "Seated_Leg_Curl") -> int:
    ex_id = await session.scalar(select(Exercise.id).where(Exercise.slug == slug))
    assert ex_id is not None
    return ex_id


async def start(client: httpx.AsyncClient, **body: Any) -> dict[str, Any]:
    r = await client.post("/api/workouts", json=body)
    assert r.status_code == 201, r.text
    result: dict[str, Any] = r.json()
    return result


async def add_exercise(
    client: httpx.AsyncClient, workout_id: str, ex_id: int, **body: Any
) -> dict[str, Any]:
    r = await client.post(
        f"/api/workouts/{workout_id}/exercises", json={"exercise_id": ex_id, **body}
    )
    assert r.status_code == 201, r.text
    result: dict[str, Any] = r.json()
    return result


async def put_set(
    client: httpx.AsyncClient, workout_exercise_id: str, set_id: str | None = None, **body: Any
) -> httpx.Response:
    return await client.put(
        f"/api/sets/{set_id or uuid.uuid4()}",
        json={"workout_exercise_id": workout_exercise_id, "position": 1, **body},
    )


NOW = datetime(2026, 9, 25, 18, 30, tzinfo=UTC).isoformat()


# --- Auth ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/workouts"),
        ("POST", "/api/workouts"),
        ("GET", "/api/workouts/active"),
        ("GET", f"/api/workouts/{uuid.uuid4()}"),
        ("PUT", f"/api/sets/{uuid.uuid4()}"),
        ("GET", "/api/exercises/1/history"),
    ],
)
async def test_requires_sign_in(client: httpx.AsyncClient, method: str, path: str) -> None:
    r = await client.request(method, path, json={})
    assert r.status_code == 401


# --- Starting, finishing, deleting --------------------------------------------------------


async def test_start_workout(auth_client: httpx.AsyncClient) -> None:
    workout = await start(auth_client, name="Day1 · Legs", performed_on="2026-09-25")
    assert workout["status"] == "in_progress"
    assert workout["name"] == "Day1 · Legs"
    assert workout["performed_on"] == "2026-09-25"
    assert workout["started_at"] is not None
    assert workout["exercises"] == []

    active = (await auth_client.get("/api/workouts/active")).json()
    assert active["id"] == workout["id"]


async def test_start_defaults_to_today(auth_client: httpx.AsyncClient) -> None:
    workout = await start(auth_client)
    assert workout["performed_on"] == date.today().isoformat()
    assert workout["name"] is None


async def test_no_active_workout_is_null(auth_client: httpx.AsyncClient) -> None:
    r = await auth_client.get("/api/workouts/active")
    assert r.status_code == 200
    assert r.json() is None


async def test_only_one_workout_in_progress(auth_client: httpx.AsyncClient) -> None:
    first = await start(auth_client)
    r = await auth_client.post("/api/workouts", json={})
    assert r.status_code == 409
    assert "already in progress" in r.json()["detail"]

    await auth_client.post(f"/api/workouts/{first['id']}/finish", json={})
    await start(auth_client)  # fine once the first is finished


async def test_start_is_idempotent_with_client_id(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    client_id = str(uuid.uuid4())
    first = await start(auth_client, id=client_id)
    retry = await start(auth_client, id=client_id)  # e.g. the response got lost offline
    assert first["id"] == retry["id"] == client_id
    assert await session.scalar(select(func.count()).select_from(Workout)) == 1


async def test_finish_workout(auth_client: httpx.AsyncClient) -> None:
    workout = await start(auth_client)
    r = await auth_client.post(f"/api/workouts/{workout['id']}/finish", json={"ended_at": NOW})
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
    assert r.json()["ended_at"].startswith("2026-09-25T18:30")

    again = await auth_client.post(f"/api/workouts/{workout['id']}/finish", json={})
    assert again.json()["ended_at"] == r.json()["ended_at"]  # finishing twice changes nothing
    assert (await auth_client.get("/api/workouts/active")).json() is None


async def test_update_workout(auth_client: httpx.AsyncClient) -> None:
    workout = await start(auth_client, name="Legs")
    url = f"/api/workouts/{workout['id']}"

    r = await auth_client.patch(url, json={"notes": "felt strong", "performed_on": "2026-09-24"})
    assert (r.json()["name"], r.json()["notes"], r.json()["performed_on"]) == (
        "Legs",  # untouched: not in the request
        "felt strong",
        "2026-09-24",
    )
    r = await auth_client.patch(url, json={"name": None})
    assert r.json()["name"] is None
    assert r.json()["notes"] == "felt strong"

    assert (await auth_client.patch(url, json={"performed_on": None})).status_code == 422
    assert (await auth_client.patch(url, json={"name": ""})).status_code == 422


async def test_delete_workout(auth_client: httpx.AsyncClient, session: AsyncSession) -> None:
    workout = await start(auth_client)
    we = (await add_exercise(auth_client, workout["id"], await exercise_id(session)))["exercises"][
        0
    ]
    await put_set(auth_client, we["id"], weight_kg=60, reps=8)

    r = await auth_client.delete(f"/api/workouts/{workout['id']}")
    assert r.status_code == 204
    assert (await auth_client.get(f"/api/workouts/{workout['id']}")).status_code == 404
    assert await session.scalar(select(func.count()).select_from(WorkoutSet)) == 0


# --- Exercises within a workout -----------------------------------------------------------


async def test_add_exercises_in_order(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    workout = await start(auth_client)
    await add_exercise(auth_client, workout["id"], await exercise_id(session, "Seated_Leg_Curl"))
    detail = await add_exercise(
        auth_client, workout["id"], await exercise_id(session, "Romanian_Deadlift")
    )
    assert [(e["position"], e["exercise"]["name"]) for e in detail["exercises"]] == [
        (1, "Seated Leg Curl"),
        (2, "Romanian Deadlift"),
    ]
    first = detail["exercises"][0]
    assert first["exercise"]["primary_muscles"] == ["hamstrings"]  # full summary included
    assert first["sets"] == []


async def test_add_exercise_is_idempotent_with_client_id(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    workout = await start(auth_client)
    body = {"id": str(uuid.uuid4())}
    ex_id = await exercise_id(session)
    await add_exercise(auth_client, workout["id"], ex_id, **body)
    detail = await add_exercise(auth_client, workout["id"], ex_id, **body)
    assert len(detail["exercises"]) == 1


async def test_add_unknown_or_foreign_custom_exercise(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    other = await create_user(session, "other@example.com")
    theirs = Exercise(slug="custom-theirs", name="Their Squat", owner_id=other.id)
    mine = Exercise(slug="custom-mine", name="Bulgarian Split Squat", owner_id=user.id)
    session.add_all([theirs, mine])
    await session.flush()
    workout = await start(auth_client)
    url = f"/api/workouts/{workout['id']}/exercises"

    assert (await auth_client.post(url, json={"exercise_id": 999999})).status_code == 404
    assert (await auth_client.post(url, json={"exercise_id": theirs.id})).status_code == 404
    assert (await auth_client.post(url, json={"exercise_id": mine.id})).status_code == 201


async def test_reorder_exercises(auth_client: httpx.AsyncClient, session: AsyncSession) -> None:
    workout = await start(auth_client)
    for slug in ("Seated_Leg_Curl", "Romanian_Deadlift", "Lying_Leg_Curls"):
        detail = await add_exercise(auth_client, workout["id"], await exercise_id(session, slug))
    ids = [e["id"] for e in detail["exercises"]]
    url = f"/api/workouts/{workout['id']}/exercises/order"

    r = await auth_client.put(url, json={"workout_exercise_ids": [ids[2], ids[0], ids[1]]})
    assert [e["exercise"]["name"] for e in r.json()["exercises"]] == [
        "Lying Leg Curls",
        "Seated Leg Curl",
        "Romanian Deadlift",
    ]
    assert [e["position"] for e in r.json()["exercises"]] == [1, 2, 3]

    missing_one = {"workout_exercise_ids": ids[:2]}
    assert (await auth_client.put(url, json=missing_one)).status_code == 422
    duplicate = {"workout_exercise_ids": [ids[0], ids[0], ids[1]]}
    assert (await auth_client.put(url, json=duplicate)).status_code == 422


async def test_remove_exercise_renumbers_and_removes_sets(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    workout = await start(auth_client)
    for slug in ("Seated_Leg_Curl", "Romanian_Deadlift", "Lying_Leg_Curls"):
        detail = await add_exercise(auth_client, workout["id"], await exercise_id(session, slug))
    middle = detail["exercises"][1]["id"]
    await put_set(auth_client, middle, weight_kg=100, reps=5)

    r = await auth_client.delete(f"/api/workout-exercises/{middle}")
    assert r.status_code == 200
    assert [(e["position"], e["exercise"]["name"]) for e in r.json()["exercises"]] == [
        (1, "Seated Leg Curl"),
        (2, "Lying Leg Curls"),
    ]
    assert await session.scalar(select(func.count()).select_from(WorkoutSet)) == 0
    assert (await auth_client.delete(f"/api/workout-exercises/{middle}")).status_code == 404


# --- Sets ---------------------------------------------------------------------------------


@pytest.fixture
async def workout_exercise(auth_client: httpx.AsyncClient, session: AsyncSession) -> str:
    workout = await start(auth_client)
    detail = await add_exercise(auth_client, workout["id"], await exercise_id(session))
    we_id: str = detail["exercises"][0]["id"]
    return we_id


async def test_save_set(auth_client: httpx.AsyncClient, workout_exercise: str) -> None:
    set_id = str(uuid.uuid4())
    r = await put_set(
        auth_client, workout_exercise, set_id, weight_kg=82.5, reps=8, rpe=8.5, completed_at=NOW
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == set_id
    # Weights are JSON numbers (not strings), even though they're exact decimals in the DB.
    assert body["weight_kg"] == 82.5
    assert body["rpe"] == 8.5
    assert (body["reps"], body["is_warmup"]) == (8, False)
    assert body["completed_at"].startswith("2026-09-25T18:30")


async def test_save_set_replaces_and_is_idempotent(
    auth_client: httpx.AsyncClient, workout_exercise: str, session: AsyncSession
) -> None:
    set_id = str(uuid.uuid4())
    await put_set(auth_client, workout_exercise, set_id, weight_kg=60, reps=8, notes="easy")
    await put_set(auth_client, workout_exercise, set_id, weight_kg=60, reps=8, notes="easy")
    r = await put_set(auth_client, workout_exercise, set_id, weight_kg=62.5, reps=6)

    assert await session.scalar(select(func.count()).select_from(WorkoutSet)) == 1
    assert (r.json()["weight_kg"], r.json()["reps"], r.json()["notes"]) == (62.5, 6, None)
    stored = await session.scalar(select(WorkoutSet.weight_kg))
    assert stored == Decimal("62.50")


@pytest.mark.parametrize(
    "fields",
    [
        {"weight_kg": -1},
        {"weight_kg": 10.125},  # more than 2 decimals
        {"weight_kg": 10000},
        {"reps": -1},
        {"reps": 2.5},
        {"rpe": 11},
        {"rpe": 7.3},  # RPE goes in half steps
        {"position": 0},
    ],
)
async def test_save_set_validation(
    auth_client: httpx.AsyncClient, workout_exercise: str, fields: dict[str, Any]
) -> None:
    assert (await put_set(auth_client, workout_exercise, **fields)).status_code == 422


async def test_delete_set_is_idempotent(
    auth_client: httpx.AsyncClient, workout_exercise: str, session: AsyncSession
) -> None:
    set_id = str(uuid.uuid4())
    await put_set(auth_client, workout_exercise, set_id, weight_kg=60, reps=8)
    assert (await auth_client.delete(f"/api/sets/{set_id}")).status_code == 204
    assert (await auth_client.delete(f"/api/sets/{set_id}")).status_code == 204
    assert await session.scalar(select(func.count()).select_from(WorkoutSet)) == 0


# --- Isolation between users --------------------------------------------------------------


async def test_other_users_cannot_see_or_touch_my_workouts(
    auth_client: httpx.AsyncClient, session: AsyncSession, workout_exercise: str
) -> None:
    my_set = str(uuid.uuid4())
    await put_set(auth_client, workout_exercise, my_set, weight_kg=60, reps=8)
    workout_id = (await auth_client.get("/api/workouts/active")).json()["id"]

    intruder = await create_user(session, "intruder@example.com")
    sign_in(auth_client, intruder)

    assert (await auth_client.get("/api/workouts")).json()["total"] == 0
    assert (await auth_client.get("/api/workouts/active")).json() is None
    for method, path, body in [
        ("GET", f"/api/workouts/{workout_id}", None),
        ("PATCH", f"/api/workouts/{workout_id}", {"name": "pwned"}),
        ("POST", f"/api/workouts/{workout_id}/finish", {}),
        ("DELETE", f"/api/workouts/{workout_id}", None),
        ("POST", f"/api/workouts/{workout_id}/exercises", {"exercise_id": 1}),
        ("DELETE", f"/api/workout-exercises/{workout_exercise}", None),
    ]:
        r = await auth_client.request(method, path, json=body)
        assert r.status_code == 404, (method, path)

    # Can't add sets to my workout, or overwrite my set by guessing its id.
    assert (await put_set(auth_client, workout_exercise, reps=1)).status_code == 404
    their_workout = await start(auth_client)
    their_we = (await add_exercise(auth_client, their_workout["id"], await exercise_id(session)))[
        "exercises"
    ][0]["id"]
    assert (await put_set(auth_client, their_we, my_set, reps=1)).status_code == 404
    # Deleting my set "succeeds" (idempotent) but must not actually delete it.
    assert (await auth_client.delete(f"/api/sets/{my_set}")).status_code == 204
    assert await session.get(WorkoutSet, uuid.UUID(my_set)) is not None


# --- History ------------------------------------------------------------------------------


async def make_workout(
    session: AsyncSession,
    user: User,
    ex_id: int,
    performed_on: date,
    sets: list[dict[str, Any]],
    *,
    status: WorkoutStatus = WorkoutStatus.COMPLETED,
    import_key: str | None = None,
    name: str | None = None,
) -> Workout:
    workout = Workout(
        user_id=user.id,
        name=name,
        performed_on=performed_on,
        status=status,
        import_key=import_key,
    )
    we = WorkoutExercise(exercise_id=ex_id, position=1)
    we.sets = [WorkoutSet(position=i, **s) for i, s in enumerate(sets, start=1)]
    workout.exercises.append(we)
    session.add(workout)
    await session.flush()
    return workout


DONE = datetime(2026, 9, 1, tzinfo=UTC)


async def test_history_lists_workouts_with_totals(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    curl = await exercise_id(session)
    # Imported: no timestamps, but every set counts.
    await make_workout(
        session,
        user,
        curl,
        date(2026, 7, 19),
        [{"weight_kg": Decimal("102"), "reps": 12}, {"weight_kg": Decimal("105"), "reps": 10}],
        import_key="legacy-sheet:2026-07-19:Day1",
        name="Day1 · Legs",
    )
    # Live: only ticked-off work sets with weight and reps count.
    await make_workout(
        session,
        user,
        curl,
        date(2026, 9, 20),
        [
            {"weight_kg": Decimal("40"), "reps": 10, "is_warmup": True, "completed_at": DONE},
            {"weight_kg": Decimal("110"), "reps": 8, "completed_at": DONE},
            {"weight_kg": Decimal("110"), "reps": 7},  # not ticked off
            {"weight_kg": Decimal("110"), "reps": None, "completed_at": DONE},  # no reps
        ],
    )

    body = (await auth_client.get("/api/workouts")).json()
    assert body["total"] == 2
    newest, oldest = body["items"]
    assert (newest["performed_on"], newest["set_count"], newest["volume_kg"]) == (
        "2026-09-20",
        1,
        880.0,
    )
    assert (oldest["name"], oldest["set_count"], oldest["volume_kg"]) == (
        "Day1 · Legs",
        2,
        2274.0,
    )
    assert oldest["exercise_names"] == ["Seated Leg Curl"]


async def test_history_pagination(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    curl = await exercise_id(session)
    for day in range(1, 6):
        await make_workout(session, user, curl, date(2026, 9, day), [])
    body = (await auth_client.get("/api/workouts", params={"limit": 2, "offset": 2})).json()
    assert body["total"] == 5
    assert [w["performed_on"] for w in body["items"]] == ["2026-09-03", "2026-09-02"]
    assert body["items"][0]["set_count"] == 0  # workouts without sets still listed


async def test_exercise_history_for_last_time_hints(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    curl = await exercise_id(session)
    other_exercise = await exercise_id(session, "Romanian_Deadlift")
    await make_workout(
        session, user, curl, date(2026, 9, 1), [{"weight_kg": Decimal("100"), "reps": 10}]
    )
    await make_workout(
        session,
        user,
        curl,
        date(2026, 9, 8),
        [{"weight_kg": Decimal("105"), "reps": 10}, {"weight_kg": Decimal("107.5"), "reps": 8}],
        name="Legs",
    )
    await make_workout(  # in progress: not history yet
        session,
        user,
        curl,
        date(2026, 9, 15),
        [{"weight_kg": Decimal("110"), "reps": 8}],
        status=WorkoutStatus.IN_PROGRESS,
    )
    await make_workout(session, user, other_exercise, date(2026, 9, 10), [])
    other = await create_user(session, "other@example.com")
    await make_workout(
        session, other, curl, date(2026, 9, 12), [{"weight_kg": Decimal("200"), "reps": 1}]
    )

    r = await auth_client.get(f"/api/exercises/{curl}/history")
    sessions = r.json()
    assert [s["performed_on"] for s in sessions] == ["2026-09-08", "2026-09-01"]
    assert sessions[0]["workout_name"] == "Legs"
    assert [(s["weight_kg"], s["reps"]) for s in sessions[0]["sets"]] == [(105.0, 10), (107.5, 8)]

    limited = await auth_client.get(f"/api/exercises/{curl}/history", params={"limit": 1})
    assert len(limited.json()) == 1
    assert (await auth_client.get("/api/exercises/999999/history")).status_code == 404


async def test_history_date_range(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    curl = await exercise_id(session)
    for day in (date(2026, 8, 31), date(2026, 9, 1), date(2026, 9, 30), date(2026, 10, 1)):
        await make_workout(session, user, curl, day, [])
    other = await create_user(session, "other@example.com")
    await make_workout(session, other, curl, date(2026, 9, 15), [])

    september: dict[str, str | int] = {
        "performed_from": "2026-09-01",
        "performed_to": "2026-09-30",
        "limit": 100,
    }
    body = (await auth_client.get("/api/workouts", params=september)).json()
    assert body["total"] == 2
    assert [w["performed_on"] for w in body["items"]] == ["2026-09-30", "2026-09-01"]

    since = (await auth_client.get("/api/workouts", params={"performed_from": "2026-09-30"})).json()
    assert since["total"] == 2
    bad = await auth_client.get("/api/workouts", params={"performed_from": "sept"})
    assert bad.status_code == 422
