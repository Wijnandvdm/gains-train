"""Workouts, the exercises within them, and their sets. Everything is scoped to the
signed-in user: another user's ids behave exactly like ids that don't exist (404).

Endpoints used by the offline queue (creating workouts/exercises with client ids, PUT and
DELETE of sets) are idempotent, so a request can safely be retried after a lost response.
"""

import uuid
from collections import defaultdict
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Select, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager, selectinload

from app.auth import CurrentUser
from app.db import get_session
from app.models import (
    Exercise,
    ExerciseMuscle,
    Routine,
    RoutineDay,
    User,
    Workout,
    WorkoutExercise,
    WorkoutSet,
    WorkoutStatus,
)
from app.schemas.exercise import ExerciseSummary
from app.schemas.workout import (
    ExerciseOrder,
    ExerciseSession,
    SetIn,
    SetOut,
    WorkoutCreate,
    WorkoutDetail,
    WorkoutExerciseIn,
    WorkoutExerciseOut,
    WorkoutFinish,
    WorkoutPage,
    WorkoutSummary,
    WorkoutUpdate,
)
from app.services.exercises import visible_to
from app.services.sets import performed_set
from app.services.workouts import newest_first

router = APIRouter(prefix="/api", tags=["workouts"])

Session = Annotated[AsyncSession, Depends(get_session)]


def _not_found(what: str = "Workout") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


# --- Loading ------------------------------------------------------------------------------


async def _owned_workout(session: AsyncSession, user: User, workout_id: uuid.UUID) -> Workout:
    workout = await session.scalar(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user.id)
    )
    if workout is None:
        raise _not_found()
    return workout


async def _workout_detail(session: AsyncSession, workout_id: uuid.UUID) -> WorkoutDetail:
    """Load a workout with its exercises and sets, fresh from the database."""
    workout = await session.scalar(
        select(Workout)
        .where(Workout.id == workout_id)
        .options(
            selectinload(Workout.exercises).options(
                selectinload(WorkoutExercise.sets),
                selectinload(WorkoutExercise.exercise)
                .selectinload(Exercise.muscles)
                .selectinload(ExerciseMuscle.muscle),
            )
        )
        # Objects already in the session may hold stale collections after edits.
        .execution_options(populate_existing=True)
    )
    assert workout is not None
    return WorkoutDetail(
        id=workout.id,
        name=workout.name,
        routine_day_id=workout.routine_day_id,
        performed_on=workout.performed_on,
        status=workout.status,
        started_at=workout.started_at,
        ended_at=workout.ended_at,
        notes=workout.notes,
        exercises=[
            WorkoutExerciseOut(
                id=we.id,
                position=we.position,
                notes=we.notes,
                exercise=ExerciseSummary.from_model(we.exercise),
                sets=[SetOut.model_validate(s) for s in we.sets],
            )
            for we in workout.exercises
        ],
    )


async def _renumber(session: AsyncSession, workout_id: uuid.UUID) -> None:
    """Make exercise positions 1..n again, keeping their order."""
    exercises = await session.scalars(
        select(WorkoutExercise)
        .where(WorkoutExercise.workout_id == workout_id)
        .order_by(WorkoutExercise.position)
    )
    for position, we in enumerate(exercises, start=1):
        we.position = position


# --- Workouts -----------------------------------------------------------------------------


@router.post("/workouts", response_model=WorkoutDetail, status_code=status.HTTP_201_CREATED)
async def start_workout(body: WorkoutCreate, user: CurrentUser, session: Session) -> WorkoutDetail:
    if body.id is not None:
        existing = await session.get(Workout, body.id)
        if existing is not None:
            if existing.user_id != user.id:
                raise HTTPException(status.HTTP_409_CONFLICT, "Workout id already in use")
            return await _workout_detail(session, existing.id)  # a retried request

    if body.routine_day_id is not None:
        owned_day = await session.scalar(
            select(RoutineDay.id)
            .join(Routine)
            .where(RoutineDay.id == body.routine_day_id, Routine.user_id == user.id)
        )
        if owned_day is None:
            raise _not_found("Routine day")

    workout = Workout(
        id=body.id or uuid.uuid4(),
        user_id=user.id,
        name=body.name,
        routine_day_id=body.routine_day_id,
        performed_on=body.performed_on or date.today(),
        started_at=body.started_at or datetime.now(UTC),
        status=WorkoutStatus.IN_PROGRESS,
    )
    session.add(workout)
    try:
        await session.commit()
    except IntegrityError:
        # The partial unique index allows one in-progress workout per user.
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Another workout is already in progress"
        ) from None
    return await _workout_detail(session, workout.id)


@router.get("/workouts/active", response_model=WorkoutDetail | None)
async def active_workout(user: CurrentUser, session: Session) -> WorkoutDetail | None:
    workout_id = await session.scalar(
        select(Workout.id).where(
            Workout.user_id == user.id, Workout.status == WorkoutStatus.IN_PROGRESS
        )
    )
    return await _workout_detail(session, workout_id) if workout_id else None


@router.get("/workouts", response_model=WorkoutPage)
async def list_workouts(
    user: CurrentUser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> WorkoutPage:
    mine = Workout.user_id == user.id
    total = await session.scalar(select(func.count()).select_from(Workout).where(mine)) or 0
    workouts = (
        await session.scalars(
            select(Workout).where(mine).order_by(*newest_first()).limit(limit).offset(offset)
        )
    ).all()
    ids = [w.id for w in workouts]

    # Totals per workout, in one query rather than one per workout.
    done = performed_set()
    totals = {
        row.workout_id: row
        for row in await session.execute(
            select(
                WorkoutExercise.workout_id,
                func.count(WorkoutSet.id).filter(done).label("sets"),
                func.coalesce(
                    func.sum(WorkoutSet.weight_kg * WorkoutSet.reps).filter(done), 0
                ).label("volume"),
            )
            .select_from(WorkoutSet)
            .join(WorkoutExercise)
            .join(Workout)
            .where(WorkoutExercise.workout_id.in_(ids))
            .group_by(WorkoutExercise.workout_id)
        )
    }
    names: dict[uuid.UUID, list[str]] = defaultdict(list)
    for workout_id, name in await session.execute(
        select(WorkoutExercise.workout_id, Exercise.name)
        .join(Exercise)
        .where(WorkoutExercise.workout_id.in_(ids))
        .order_by(WorkoutExercise.workout_id, WorkoutExercise.position)
    ):
        names[workout_id].append(name)

    return WorkoutPage(
        items=[
            WorkoutSummary(
                id=w.id,
                name=w.name,
                routine_day_id=w.routine_day_id,
                performed_on=w.performed_on,
                status=w.status,
                started_at=w.started_at,
                ended_at=w.ended_at,
                exercise_names=names[w.id],
                set_count=totals[w.id].sets if w.id in totals else 0,
                volume_kg=float(totals[w.id].volume) if w.id in totals else 0.0,
            )
            for w in workouts
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/workouts/{workout_id}", response_model=WorkoutDetail)
async def get_workout(workout_id: uuid.UUID, user: CurrentUser, session: Session) -> WorkoutDetail:
    await _owned_workout(session, user, workout_id)
    return await _workout_detail(session, workout_id)


@router.patch("/workouts/{workout_id}", response_model=WorkoutDetail)
async def update_workout(
    workout_id: uuid.UUID, body: WorkoutUpdate, user: CurrentUser, session: Session
) -> WorkoutDetail:
    workout = await _owned_workout(session, user, workout_id)
    # Only fields present in the request change; sending null clears name/notes.
    for field in body.model_fields_set:
        value = getattr(body, field)
        if field == "performed_on" and value is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "performed_on can't be null")
        setattr(workout, field, value)
    await session.commit()
    return await _workout_detail(session, workout_id)


@router.post("/workouts/{workout_id}/finish", response_model=WorkoutDetail)
async def finish_workout(
    workout_id: uuid.UUID, body: WorkoutFinish, user: CurrentUser, session: Session
) -> WorkoutDetail:
    workout = await _owned_workout(session, user, workout_id)
    if workout.status == WorkoutStatus.IN_PROGRESS:  # finishing twice is a no-op
        workout.status = WorkoutStatus.COMPLETED
        workout.ended_at = body.ended_at or datetime.now(UTC)
        await session.commit()
    return await _workout_detail(session, workout_id)


@router.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(workout_id: uuid.UUID, user: CurrentUser, session: Session) -> None:
    workout = await _owned_workout(session, user, workout_id)
    await session.delete(workout)  # exercises and sets cascade in the database
    await session.commit()


# --- Exercises within a workout -----------------------------------------------------------


@router.post(
    "/workouts/{workout_id}/exercises",
    response_model=WorkoutDetail,
    status_code=status.HTTP_201_CREATED,
)
async def add_workout_exercise(
    workout_id: uuid.UUID, body: WorkoutExerciseIn, user: CurrentUser, session: Session
) -> WorkoutDetail:
    await _owned_workout(session, user, workout_id)

    if body.id is not None:
        existing = await session.get(WorkoutExercise, body.id)
        if existing is not None:
            if existing.workout_id != workout_id:
                raise HTTPException(status.HTTP_409_CONFLICT, "Workout exercise id already in use")
            return await _workout_detail(session, workout_id)  # a retried request

    exercise_id = await session.scalar(
        select(Exercise.id).where(Exercise.id == body.exercise_id, visible_to(user.id))
    )
    if exercise_id is None:
        raise _not_found("Exercise")

    last_position = await session.scalar(
        select(func.max(WorkoutExercise.position)).where(WorkoutExercise.workout_id == workout_id)
    )
    session.add(
        WorkoutExercise(
            id=body.id or uuid.uuid4(),
            workout_id=workout_id,
            exercise_id=exercise_id,
            position=(last_position or 0) + 1,
            notes=body.notes,
        )
    )
    await session.commit()
    return await _workout_detail(session, workout_id)


@router.put("/workouts/{workout_id}/exercises/order", response_model=WorkoutDetail)
async def reorder_workout_exercises(
    workout_id: uuid.UUID, body: ExerciseOrder, user: CurrentUser, session: Session
) -> WorkoutDetail:
    await _owned_workout(session, user, workout_id)
    exercises = {
        we.id: we
        for we in await session.scalars(
            select(WorkoutExercise).where(WorkoutExercise.workout_id == workout_id)
        )
    }
    if sorted(body.workout_exercise_ids) != sorted(exercises):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "workout_exercise_ids must list each of the workout's exercises exactly once",
        )
    for position, we_id in enumerate(body.workout_exercise_ids, start=1):
        exercises[we_id].position = position
    await session.commit()
    return await _workout_detail(session, workout_id)


@router.delete("/workout-exercises/{workout_exercise_id}", response_model=WorkoutDetail)
async def remove_workout_exercise(
    workout_exercise_id: uuid.UUID, user: CurrentUser, session: Session
) -> WorkoutDetail:
    we = await session.scalar(
        select(WorkoutExercise)
        .join(Workout)
        .where(WorkoutExercise.id == workout_exercise_id, Workout.user_id == user.id)
    )
    if we is None:
        raise _not_found("Workout exercise")
    workout_id = we.workout_id
    await session.delete(we)  # its sets cascade in the database
    await session.flush()
    await _renumber(session, workout_id)
    await session.commit()
    return await _workout_detail(session, workout_id)


# --- Sets ---------------------------------------------------------------------------------


def _owned_set(set_id: uuid.UUID, user: User) -> Select[tuple[WorkoutSet]]:
    return (
        select(WorkoutSet)
        .join(WorkoutExercise)
        .join(Workout)
        .where(WorkoutSet.id == set_id, Workout.user_id == user.id)
    )


@router.put("/sets/{set_id}", response_model=SetOut)
async def save_set(set_id: uuid.UUID, body: SetIn, user: CurrentUser, session: Session) -> SetOut:
    """Create or replace a set. The client picks the id, so retries are harmless."""
    target = await session.scalar(
        select(WorkoutExercise.id)
        .join(Workout)
        .where(WorkoutExercise.id == body.workout_exercise_id, Workout.user_id == user.id)
    )
    if target is None:
        raise _not_found("Workout exercise")

    workout_set = await session.scalar(_owned_set(set_id, user))
    if workout_set is None:
        if await session.get(WorkoutSet, set_id) is not None:
            raise _not_found("Set")  # someone else's set id: don't reveal or overwrite it
        workout_set = WorkoutSet(id=set_id)
        session.add(workout_set)

    for field, value in body.model_dump().items():
        setattr(workout_set, field, value)
    await session.commit()
    return SetOut.model_validate(workout_set)


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_set(set_id: uuid.UUID, user: CurrentUser, session: Session) -> Response:
    """Idempotent: deleting a set that's already gone also succeeds."""
    owned = await session.scalar(_owned_set(set_id, user))
    if owned is not None:
        await session.execute(delete(WorkoutSet).where(WorkoutSet.id == owned.id))
        await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Exercise history ---------------------------------------------------------------------


@router.get("/exercises/{exercise_id}/history", response_model=list[ExerciseSession])
async def exercise_history(
    exercise_id: int,
    user: CurrentUser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=50)] = 5,
) -> list[ExerciseSession]:
    """Your previous (finished) sessions of an exercise, newest first."""
    visible = await session.scalar(
        select(Exercise.id).where(Exercise.id == exercise_id, visible_to(user.id))
    )
    if visible is None:
        raise _not_found("Exercise")

    rows = await session.scalars(
        select(WorkoutExercise)
        .join(WorkoutExercise.workout)
        .where(
            WorkoutExercise.exercise_id == exercise_id,
            Workout.user_id == user.id,
            Workout.status == WorkoutStatus.COMPLETED,
        )
        .order_by(
            Workout.performed_on.desc(),
            Workout.started_at.desc().nulls_last(),
            WorkoutExercise.position.desc(),
        )
        .limit(limit)
        .options(contains_eager(WorkoutExercise.workout), selectinload(WorkoutExercise.sets))
    )
    return [
        ExerciseSession(
            workout_id=we.workout.id,
            workout_name=we.workout.name,
            performed_on=we.workout.performed_on,
            sets=[SetOut.model_validate(s) for s in we.sets],
        )
        for we in rows
    ]
