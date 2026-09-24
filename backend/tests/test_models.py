from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Exercise,
    ExerciseMuscle,
    Muscle,
    MuscleRole,
    User,
    Workout,
    WorkoutExercise,
    WorkoutSet,
    WorkoutStatus,
)


async def make_user(session: AsyncSession, email: str = "me@example.com") -> User:
    user = User(email=email)
    session.add(user)
    await session.flush()
    return user


async def make_exercise(session: AsyncSession, slug: str = "Barbell_Bench_Press") -> Exercise:
    exercise = Exercise(slug=slug, name=slug.replace("_", " "))
    session.add(exercise)
    await session.flush()
    return exercise


async def test_full_workout_graph_round_trips(session: AsyncSession) -> None:
    user = await make_user(session)
    # Build relationships before the first flush: once an object is persistent, touching an
    # unloaded relationship triggers a lazy load, which async sessions don't allow.
    exercise = Exercise(
        slug="Barbell_Bench_Press",
        name="Barbell Bench Press",
        muscles=[ExerciseMuscle(muscle=Muscle(name="chest"), role=MuscleRole.PRIMARY)],
    )
    session.add(exercise)
    workout = Workout(
        user_id=user.id,
        name="Day3 · Chest & Biceps",
        performed_on=date(2026, 9, 9),
        status=WorkoutStatus.COMPLETED,
    )
    we = WorkoutExercise(exercise=exercise, position=1)
    we.sets = [
        WorkoutSet(position=1, weight_kg=Decimal("8.8"), reps=12),
        WorkoutSet(position=2, weight_kg=Decimal("8.8"), reps=None, notes="forgot reps"),
    ]
    workout.exercises.append(we)
    session.add(workout)
    await session.commit()

    loaded = await session.scalar(select(WorkoutSet).where(WorkoutSet.position == 1))
    assert loaded is not None
    assert loaded.weight_kg == Decimal("8.80")  # NUMERIC keeps 8.8 exact, no float rounding
    assert loaded.is_warmup is False
    assert exercise.is_custom is False


async def test_one_in_progress_workout_per_user(session: AsyncSession) -> None:
    user = await make_user(session)
    session.add(Workout(user_id=user.id, performed_on=date(2026, 9, 24)))
    await session.flush()
    # Completed workouts don't count towards the limit.
    session.add(
        Workout(user_id=user.id, performed_on=date(2026, 9, 23), status=WorkoutStatus.COMPLETED)
    )
    await session.flush()

    session.add(Workout(user_id=user.id, performed_on=date(2026, 9, 24)))
    with pytest.raises(IntegrityError, match="uq_workouts_user_id_in_progress"):
        await session.flush()


async def test_import_key_is_unique_per_user(session: AsyncSession) -> None:
    me = await make_user(session)
    friend = await make_user(session, "friend@example.com")
    key = "legacy-sheet:2026-07-19:Day1"
    for user in (me, friend):  # same key for different users is fine
        session.add(
            Workout(
                user_id=user.id,
                performed_on=date(2026, 7, 19),
                status=WorkoutStatus.COMPLETED,
                import_key=key,
            )
        )
    await session.flush()

    session.add(
        Workout(
            user_id=me.id,
            performed_on=date(2026, 7, 19),
            status=WorkoutStatus.COMPLETED,
            import_key=key,
        )
    )
    with pytest.raises(IntegrityError, match="uq_workouts_user_id_import_key"):
        await session.flush()


async def test_custom_exercise_names_unique_per_owner_case_insensitive(
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    session.add(Exercise(slug="custom-1", name="Hack Squat", owner_id=user.id))
    await session.flush()
    session.add(Exercise(slug="custom-2", name="hack squat", owner_id=user.id))
    with pytest.raises(IntegrityError, match="uq_exercises_owner_id_lower_name"):
        await session.flush()


@pytest.mark.parametrize(
    ("field", "value", "constraint"),
    [
        ("weight_kg", Decimal("-1"), "ck_sets_weight_kg_non_negative"),
        ("reps", -1, "ck_sets_reps_non_negative"),
        ("rpe", Decimal("11"), "ck_sets_rpe_range"),
    ],
)
async def test_set_check_constraints(
    session: AsyncSession, field: str, value: object, constraint: str
) -> None:
    user = await make_user(session)
    exercise = await make_exercise(session)
    workout = Workout(user_id=user.id, performed_on=date(2026, 9, 24))
    we = WorkoutExercise(exercise=exercise, position=1)
    we.sets.append(WorkoutSet(position=1, **{field: value}))
    workout.exercises.append(we)
    session.add(workout)
    with pytest.raises(IntegrityError, match=constraint):
        await session.flush()


async def test_deleting_user_cascades_to_their_data(session: AsyncSession) -> None:
    user = await make_user(session)
    exercise = await make_exercise(session)
    workout = Workout(user_id=user.id, performed_on=date(2026, 9, 24))
    we = WorkoutExercise(exercise=exercise, position=1)
    we.sets.append(WorkoutSet(position=1, weight_kg=Decimal("60"), reps=8))
    workout.exercises.append(we)
    session.add(workout)
    await session.flush()

    # Delete through SQL so we test the database's ON DELETE CASCADE, not the ORM's.
    await session.execute(delete(User).where(User.id == user.id))
    session.expunge_all()

    assert await session.scalar(select(func.count()).select_from(Workout)) == 0
    assert await session.scalar(select(func.count()).select_from(WorkoutSet)) == 0
    # Library exercises are shared and must survive.
    assert await session.scalar(select(func.count()).select_from(Exercise)) == 1
