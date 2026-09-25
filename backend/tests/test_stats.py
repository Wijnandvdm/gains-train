import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.importers.free_exercise_db import seed_library
from app.models import Exercise, User, WorkoutStatus
from app.services.stats import PerformedSet, e1rm, overview, records, sessions
from tests.conftest import create_user
from tests.test_exercise_library import LIBRARY
from tests.test_workouts import make_workout

W1, W2, W3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
D1, D2, D3 = date(2026, 9, 1), date(2026, 9, 8), date(2026, 9, 15)


def s(workout: uuid.UUID, day: date, weight: str, reps: int, exercise: int = 1) -> PerformedSet:
    return PerformedSet(exercise, workout, day, Decimal(weight), reps)


# --- Pure functions -----------------------------------------------------------------------


def test_e1rm_epley() -> None:
    assert e1rm(Decimal("100"), 1) == Decimal("100")
    assert e1rm(Decimal("100"), 10) == Decimal("100") * (1 + Decimal(10) / 30)  # ≈ 133.3
    assert e1rm(Decimal("60"), 0) is None


def test_sessions_summarise_each_workout() -> None:
    result = sessions(
        [
            s(W1, D1, "80", 12),
            s(W1, D1, "85", 8),
            s(W1, D1, "85", 10),
            s(W2, D2, "90", 5),
        ]
    )
    assert [(r.performed_on, r.top_weight_kg, r.top_weight_reps, r.set_count) for r in result] == [
        (D1, Decimal("85"), 10, 3),
        (D2, Decimal("90"), 5, 1),
    ]
    assert result[0].volume_kg == Decimal(80 * 12 + 85 * 8 + 85 * 10)
    assert result[0].best_e1rm_kg == e1rm(Decimal("85"), 10)


def test_records() -> None:
    result = records(
        [
            s(W1, D1, "80", 12),
            s(W1, D1, "85", 10),
            s(W2, D2, "90", 6),
            s(W2, D2, "85", 12),  # rep record at 85 kg, beats 80 × 12
            s(W3, D3, "90", 6),  # ties the heaviest: the record stays dated D2
            s(W3, D3, "70", 15),
        ]
    )
    assert result is not None
    assert (result.heaviest.weight_kg, result.heaviest.reps, result.heaviest.performed_on) == (
        Decimal("90"),
        6,
        D2,
    )
    assert (result.best_e1rm.weight_kg, result.best_e1rm.reps) == (Decimal("85"), 12)
    assert result.best_e1rm_kg == e1rm(Decimal("85"), 12)
    assert result.best_session_volume_on == D1  # 80×12 + 85×10 = 1810 beats 1560 and 1590
    # 80 × 12 is dropped: 85 kg was also done for 12.
    assert [(r.weight_kg, r.reps) for r in result.rep_records] == [
        (Decimal("90"), 6),
        (Decimal("85"), 12),
        (Decimal("70"), 15),
    ]


def test_records_of_nothing() -> None:
    assert records([]) is None
    assert records([s(W1, D1, "60", 0)]) is None


def test_overview_matches_the_legacy_dashboard_columns() -> None:
    rows = overview(
        [
            s(W1, D1, "85", 10, exercise=1),
            s(W2, D2, "90", 12, exercise=1),
            s(W3, D3, "85", 10, exercise=1),  # lighter last session
            s(W1, D1, "30", 10, exercise=2),
        ]
    )
    assert [r.exercise_id for r in rows] == [1, 2]  # most recently trained first
    lat = rows[0]
    assert (lat.sets_logged, lat.last_performed_on) == (3, D3)
    assert (lat.last_top_weight_kg, lat.max_weight_kg) == (Decimal("85"), Decimal("90"))
    assert lat.total_volume_kg == Decimal(85 * 10 + 90 * 12 + 85 * 10)


# --- API ----------------------------------------------------------------------------------


@pytest.fixture(autouse=True)
async def library(session: AsyncSession) -> None:
    await seed_library(session, LIBRARY)


async def exercise_id(session: AsyncSession, slug: str) -> int:
    ex_id = await session.scalar(select(Exercise.id).where(Exercise.slug == slug))
    assert ex_id is not None
    return ex_id


DONE = datetime(2026, 9, 1, tzinfo=UTC)


async def test_exercise_stats(
    auth_client: httpx.AsyncClient, session: AsyncSession, user: User
) -> None:
    curl = await exercise_id(session, "Seated_Leg_Curl")
    await make_workout(
        session,
        user,
        curl,
        D1,
        [{"weight_kg": Decimal("102.5"), "reps": 12}, {"weight_kg": Decimal("105"), "reps": 10}],
        import_key="legacy",
    )
    await make_workout(
        session,
        user,
        curl,
        D2,
        [
            {"weight_kg": Decimal("110"), "reps": 8, "completed_at": DONE},
            {"weight_kg": Decimal("150"), "reps": 1},  # never ticked off: doesn't count
            {"weight_kg": Decimal("50"), "reps": 20, "is_warmup": True, "completed_at": DONE},
        ],
    )
    await make_workout(  # in progress: not counted until finished
        session,
        user,
        curl,
        D3,
        [{"weight_kg": Decimal("200"), "reps": 5, "completed_at": DONE}],
        status=WorkoutStatus.IN_PROGRESS,
    )
    other = await create_user(session, "other@example.com")
    await make_workout(
        session, other, curl, D3, [{"weight_kg": Decimal("300"), "reps": 5}], import_key="x"
    )

    body = (await auth_client.get(f"/api/stats/exercises/{curl}")).json()
    assert [(p["performed_on"], p["top_weight_kg"], p["set_count"]) for p in body["sessions"]] == [
        ("2026-09-01", 105.0, 2),
        ("2026-09-08", 110.0, 1),
    ]
    rec = body["records"]
    assert rec["heaviest"] == {"weight_kg": 110.0, "reps": 8, "performed_on": "2026-09-08"}
    # e1RM: 102.5 × 12 → 143.5 beats 105 × 10 → 140.0 and 110 × 8 → 139.3
    assert (rec["best_e1rm"]["weight_kg"], rec["best_e1rm"]["reps"]) == (102.5, 12)
    assert rec["best_e1rm_kg"] == pytest.approx(143.5)
    assert rec["best_session_volume_kg"] == 102.5 * 12 + 105 * 10
    assert [(r["weight_kg"], r["reps"]) for r in rec["rep_records"]] == [
        (110.0, 8),
        (105.0, 10),
        (102.5, 12),
    ]


async def test_exercise_stats_before_first_session(
    auth_client: httpx.AsyncClient, session: AsyncSession
) -> None:
    curl = await exercise_id(session, "Seated_Leg_Curl")
    body = (await auth_client.get(f"/api/stats/exercises/{curl}")).json()
    assert body == {"records": None, "sessions": []}
    assert (await auth_client.get("/api/stats/exercises/999999")).status_code == 404


async def test_overview(auth_client: httpx.AsyncClient, session: AsyncSession, user: User) -> None:
    curl = await exercise_id(session, "Seated_Leg_Curl")
    rdl = await exercise_id(session, "Romanian_Deadlift")
    await make_workout(
        session, user, curl, D1, [{"weight_kg": Decimal("100"), "reps": 10}], import_key="a"
    )
    await make_workout(
        session, user, rdl, D2, [{"weight_kg": Decimal("80"), "reps": 8}], import_key="b"
    )

    body = (await auth_client.get("/api/stats/overview")).json()
    assert [row["exercise"]["name"] for row in body] == ["Romanian Deadlift", "Seated Leg Curl"]
    assert body[1] == {
        "exercise": body[1]["exercise"],
        "sets_logged": 1,
        "last_performed_on": "2026-09-01",
        "last_top_weight_kg": 100.0,
        "max_weight_kg": 100.0,
        "best_e1rm_kg": pytest.approx(133.33, abs=0.01),
        "total_volume_kg": 1000.0,
    }


async def test_stats_require_sign_in(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/stats/overview")).status_code == 401
    assert (await client.get("/api/stats/exercises/1")).status_code == 401
