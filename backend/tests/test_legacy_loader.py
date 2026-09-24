import io
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.importers.free_exercise_db import seed_library
from app.importers.legacy_loader import (
    DEFAULT_MAPPING_FILE,
    CustomExerciseSpec,
    ExerciseMapping,
    LegacyImportError,
    import_legacy,
)
from app.importers.legacy_sheet import ParseResult, parse_legacy_log
from app.models import Exercise, User, Workout, WorkoutExercise, WorkoutSet
from tests.test_exercise_library import LIBRARY, free_exercise

HEADER = "Date,Day,Exercise,Set,Weight (kg),Reps,Muscle Group,Notes,\n"
SHEET = (
    "2026-07-19,Day1,Leg Curl,1,102.0,12,Legs,,\n"
    "2026-07-19,Day1,Leg Curl,2,105.0,10,Legs,,\n"
    "2026-07-19,Day1,Bulgarian Split Squat,1,22.0,10,Legs,,leg day\n"
    "2026-07-23,Day3,incline dumbbell curl,1,14.0,12,Chest & Biceps,good pump,\n"
    "2026-07-24,Day3,incline dumbbell curl,2,14.0,,Chest & Biceps,,\n"
)
MAPPING = ExerciseMapping(
    library={"Leg Curl": "Seated_Leg_Curl"},
    custom={
        "Bulgarian Split Squat": CustomExerciseSpec(
            equipment="dumbbell", primary_muscles=["hamstrings"], secondary_muscles=["glutes"]
        )
    },
)
EMAIL = "Me@Example.com"


def sheet(body: str = SHEET) -> ParseResult:
    return parse_legacy_log(io.StringIO(HEADER + body))


@pytest.fixture(autouse=True)
async def library(session: AsyncSession) -> None:
    await seed_library(session, LIBRARY)


async def count(session: AsyncSession, model: type[object]) -> int:
    return await session.scalar(select(func.count()).select_from(model)) or 0


async def test_imports_workouts_sets_and_custom_exercise(session: AsyncSession) -> None:
    stats = await import_legacy(session, EMAIL, sheet(), MAPPING)

    assert stats.user_created
    assert (stats.workouts_created, stats.workouts_updated, stats.sets) == (2, 0, 5)
    assert stats.exercise_map == {
        "Leg Curl": "Seated Leg Curl",  # via [library]
        "Bulgarian Split Squat": "Bulgarian Split Squat (custom)",  # via [custom]
        "incline dumbbell curl": "Incline Dumbbell Curl",  # exact name, case-insensitive
    }

    user = await session.scalar(select(User))
    assert user is not None and user.email == "me@example.com"
    workouts = (
        await session.scalars(
            select(Workout)
            .order_by(Workout.performed_on)
            .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.sets))
        )
    ).all()
    assert [(w.name, w.status, w.notes) for w in workouts] == [
        ("Day1 · Legs", "completed", "leg day"),
        ("Day3 · Chest & Biceps", "completed", None),
    ]
    day1 = workouts[0]
    assert [(s.position, s.weight_kg, s.reps) for s in day1.exercises[0].sets] == [
        (1, Decimal("102.00"), 12),
        (2, Decimal("105.00"), 10),
    ]
    curl_sets = workouts[1].exercises[0].sets
    assert [(s.reps, s.notes) for s in curl_sets] == [(12, "good pump"), (None, None)]

    custom = await session.scalar(select(Exercise).where(Exercise.owner_id == user.id))
    assert custom is not None and custom.equipment == "dumbbell"


async def test_reimport_updates_in_place_without_duplicates(session: AsyncSession) -> None:
    await import_legacy(session, EMAIL, sheet(), MAPPING)
    edited = SHEET.replace("105.0,10", "107.5,9")
    stats = await import_legacy(session, EMAIL, sheet(edited), MAPPING)

    assert not stats.user_created
    assert (stats.workouts_created, stats.workouts_updated) == (0, 2)
    assert await count(session, Workout) == 2
    assert await count(session, WorkoutSet) == 5
    assert await count(session, Exercise) == len(LIBRARY) + 1  # custom exercise reused
    weights = set(await session.scalars(select(WorkoutSet.weight_kg)))
    assert Decimal("107.50") in weights and Decimal("105.00") not in weights


async def test_imports_are_per_user(session: AsyncSession) -> None:
    await import_legacy(session, EMAIL, sheet(), MAPPING)
    await import_legacy(session, "friend@example.com", sheet(), MAPPING)
    assert await count(session, User) == 2
    assert await count(session, Workout) == 4
    assert await count(session, Exercise) == len(LIBRARY) + 2  # one custom exercise each


async def test_unmapped_names_are_all_reported(session: AsyncSession) -> None:
    body = SHEET + "2026-07-25,Day1,Mystery Machine,1,50,10,Legs,,\n"
    mapping = ExerciseMapping(library={"Leg Curl": "Does_Not_Exist"})
    with pytest.raises(LegacyImportError) as exc:
        await import_legacy(session, EMAIL, sheet(body), mapping)
    message = str(exc.value)
    assert "'Leg Curl' → library id 'Does_Not_Exist' doesn't exist" in message
    assert "'Mystery Machine' isn't mapped" in message
    assert "'Bulgarian Split Squat' isn't mapped" in message


async def test_custom_exercise_with_unknown_muscle_is_rejected(session: AsyncSession) -> None:
    mapping = ExerciseMapping(
        library=MAPPING.library,
        custom={"Bulgarian Split Squat": CustomExerciseSpec(primary_muscles=["quads"])},
    )
    with pytest.raises(LegacyImportError, match=r"unknown muscle\(s\) \['quads'\]"):
        await import_legacy(session, EMAIL, sheet(), mapping)


async def test_ambiguous_exact_name_is_not_guessed(session: AsyncSession) -> None:
    # Two library exercises with the same name: refuse rather than pick one.
    await seed_library(session, [*LIBRARY, free_exercise("Leg_Curl_2", "Seated Leg Curl")])
    body = "2026-07-19,Day1,Seated Leg Curl,1,100,10,Legs,,\n"
    with pytest.raises(LegacyImportError, match="'Seated Leg Curl' isn't mapped"):
        await import_legacy(session, EMAIL, sheet(body), ExerciseMapping())


def test_default_mapping_file_is_valid() -> None:
    mapping = ExerciseMapping.from_file(DEFAULT_MAPPING_FILE)
    assert mapping.library["Leg Curl"] == "Seated_Leg_Curl"
    assert "Bulgarian Split Squat" in mapping.custom
