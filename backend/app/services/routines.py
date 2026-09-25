import re
import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Exercise,
    ExerciseMuscle,
    Routine,
    RoutineDay,
    RoutineExercise,
    User,
    Workout,
    WorkoutExercise,
    WorkoutStatus,
)
from app.services.workouts import newest_first


async def load_routine(session: AsyncSession, user: User) -> Routine | None:
    """The user's routine with days, exercises and (for summaries) muscles, fresh from the DB."""
    routine: Routine | None = await session.scalar(
        select(Routine)
        .where(Routine.user_id == user.id)
        .options(
            selectinload(Routine.days)
            .selectinload(RoutineDay.exercises)
            .selectinload(RoutineExercise.exercise)
            .selectinload(Exercise.muscles)
            .selectinload(ExerciseMuscle.muscle)
        )
        .execution_options(populate_existing=True)
    )
    return routine


async def next_day_id(session: AsyncSession, user: User, routine: Routine) -> uuid.UUID | None:
    """The day after the last finished routine day (wrapping around); the first day if none."""
    if not routine.days:
        return None
    day_ids = [d.id for d in routine.days]
    last = await session.scalar(
        select(Workout.routine_day_id)
        .where(
            Workout.user_id == user.id,
            Workout.status == WorkoutStatus.COMPLETED,
            Workout.routine_day_id.in_(day_ids),
        )
        .order_by(*newest_first())
        .limit(1)
    )
    if last is None:
        return day_ids[0]
    return day_ids[(day_ids.index(last) + 1) % len(day_ids)]


def _natural_key(name: str) -> list[int | str]:
    """Sort "Day2" before "Day10"."""
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


async def routine_from_history(session: AsyncSession, user: User) -> Routine | None:
    """Build a routine from the named workouts in your history (e.g. your Day1/2/3 split).

    Each distinct workout name becomes a day, with the exercises (and number of work sets)
    of the most recent workout by that name. Past workouts are linked to their day, so
    the rotation continues where you left off. Replaces any existing routine. Returns None
    if there are no named workouts. The caller commits.
    """
    workouts = (
        await session.scalars(
            select(Workout)
            .where(
                Workout.user_id == user.id,
                Workout.status == WorkoutStatus.COMPLETED,
                Workout.name.is_not(None),
            )
            .order_by(*newest_first())
            .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.sets))
        )
    ).all()
    latest_by_name: dict[str, Workout] = {}
    for workout in workouts:
        assert workout.name is not None
        latest_by_name.setdefault(workout.name, workout)
    if not latest_by_name:
        return None

    # SQL delete: the database cascades to days/exercises (and unlinks old workouts).
    await session.execute(delete(Routine).where(Routine.user_id == user.id))

    routine = Routine(user_id=user.id)
    for position, name in enumerate(sorted(latest_by_name, key=_natural_key), start=1):
        source = latest_by_name[name]
        routine.days.append(
            RoutineDay(
                id=uuid.uuid4(),
                position=position,
                name=name,
                exercises=[
                    RoutineExercise(
                        position=i,
                        exercise_id=we.exercise_id,
                        sets=max(1, min(20, sum(1 for s in we.sets if not s.is_warmup))),
                    )
                    for i, we in enumerate(source.exercises, start=1)
                ],
            )
        )
    session.add(routine)
    await session.flush()

    for day in routine.days:
        await session.execute(
            update(Workout)
            .where(Workout.user_id == user.id, Workout.name == day.name)
            .values(routine_day_id=day.id)
        )
    return routine
