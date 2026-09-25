"""Progress and personal records. Only finished workouts count; the workout in progress
is compared against these records on the phone (see frontend src/workout/prs.ts)."""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.db import get_session
from app.models import Exercise, User, Workout, WorkoutExercise, WorkoutSet, WorkoutStatus
from app.schemas.exercise import ExerciseSummary
from app.schemas.stats import (
    ExerciseOverviewOut,
    ExerciseStats,
    RecordsOut,
    SessionPoint,
    SetRecordOut,
)
from app.services import stats
from app.services.exercises import load_muscles, visible_to
from app.services.sets import performed_set

router = APIRouter(prefix="/api/stats", tags=["stats"])

Session = Annotated[AsyncSession, Depends(get_session)]


def kg(value: Decimal) -> float:
    return float(round(value, 2))


async def _performed_sets(
    session: AsyncSession, user: User, exercise_id: int | None = None
) -> list[stats.PerformedSet]:
    stmt = (
        select(
            WorkoutExercise.exercise_id,
            Workout.id,
            Workout.performed_on,
            WorkoutSet.weight_kg,
            WorkoutSet.reps,
        )
        .select_from(WorkoutSet)
        .join(WorkoutExercise)
        .join(Workout)
        .where(
            Workout.user_id == user.id,
            Workout.status == WorkoutStatus.COMPLETED,
            performed_set(),  # guarantees weight and reps are set
        )
        .order_by(Workout.performed_on, Workout.started_at.nulls_first(), WorkoutSet.position)
    )
    if exercise_id is not None:
        stmt = stmt.where(WorkoutExercise.exercise_id == exercise_id)
    return [
        stats.PerformedSet(ex_id, workout_id, performed_on, weight, reps)
        for ex_id, workout_id, performed_on, weight, reps in await session.execute(stmt)
        if weight is not None and reps is not None
    ]


def _set_record(r: stats.SetRecord) -> SetRecordOut:
    return SetRecordOut(weight_kg=kg(r.weight_kg), reps=r.reps, performed_on=r.performed_on)


@router.get("/overview", response_model=list[ExerciseOverviewOut])
async def stats_overview(user: CurrentUser, session: Session) -> list[ExerciseOverviewOut]:
    """Every exercise you've done, most recently trained first."""
    rows = stats.overview(await _performed_sets(session, user))
    exercises = {
        ex.id: ex
        for ex in await session.scalars(
            select(Exercise)
            .where(Exercise.id.in_([r.exercise_id for r in rows]))
            .options(load_muscles())
        )
    }
    return [
        ExerciseOverviewOut(
            exercise=ExerciseSummary.from_model(exercises[r.exercise_id]),
            sets_logged=r.sets_logged,
            last_performed_on=r.last_performed_on,
            last_top_weight_kg=kg(r.last_top_weight_kg),
            max_weight_kg=kg(r.max_weight_kg),
            best_e1rm_kg=kg(r.best_e1rm_kg),
            total_volume_kg=kg(r.total_volume_kg),
        )
        for r in rows
    ]


@router.get("/exercises/{exercise_id}", response_model=ExerciseStats)
async def exercise_stats(exercise_id: int, user: CurrentUser, session: Session) -> ExerciseStats:
    visible = await session.scalar(
        select(Exercise.id).where(Exercise.id == exercise_id, visible_to(user.id))
    )
    if visible is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    sets = await _performed_sets(session, user, exercise_id)
    records = stats.records(sets)
    return ExerciseStats(
        records=RecordsOut(
            heaviest=_set_record(records.heaviest),
            best_e1rm=_set_record(records.best_e1rm),
            best_e1rm_kg=kg(records.best_e1rm_kg),
            best_session_volume_kg=kg(records.best_session_volume_kg),
            best_session_volume_on=records.best_session_volume_on,
            rep_records=[_set_record(r) for r in records.rep_records],
        )
        if records
        else None,
        sessions=[
            SessionPoint(
                workout_id=s.workout_id,
                performed_on=s.performed_on,
                top_weight_kg=kg(s.top_weight_kg),
                top_weight_reps=s.top_weight_reps,
                best_e1rm_kg=kg(s.best_e1rm_kg),
                volume_kg=kg(s.volume_kg),
                set_count=s.set_count,
            )
            for s in stats.sessions(sets)
        ],
    )
