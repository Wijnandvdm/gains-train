import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import ColumnElement, Select, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, selectinload

from app.auth import OptionalUserId
from app.db import get_session
from app.models import Exercise, ExerciseMuscle, Muscle, MuscleRole
from app.schemas.exercise import (
    ExerciseDetail,
    ExerciseFilters,
    ExercisePage,
    ExerciseSummary,
)

router = APIRouter(prefix="/api", tags=["exercises"])

Session = Annotated[AsyncSession, Depends(get_session)]


def _visible_to(user_id: uuid.UUID | None) -> ColumnElement[bool]:
    """Library exercises are visible to everyone; custom ones only to their owner."""
    if user_id is None:
        return Exercise.owner_id.is_(None)
    return or_(Exercise.owner_id.is_(None), Exercise.owner_id == user_id)


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _with_muscles(stmt: Select[tuple[Exercise]]) -> Select[tuple[Exercise]]:
    # Async sessions can't lazy-load, so load muscle links + names up front (2 extra queries).
    return stmt.options(selectinload(Exercise.muscles).selectinload(ExerciseMuscle.muscle))


@router.get("/exercises", response_model=ExercisePage)
async def list_exercises(
    session: Session,
    user_id: OptionalUserId,
    q: Annotated[str | None, Query(max_length=100, description="Search words in the name")] = None,
    muscle: Annotated[str | None, Query(description="Primary muscle, e.g. 'chest'")] = None,
    equipment: str | None = None,
    category: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ExercisePage:
    conditions: list[ColumnElement[bool]] = [_visible_to(user_id)]
    words = q.split() if q else []
    # Every word must appear somewhere in the name: "incline curl" finds "Incline Dumbbell Curl".
    conditions += [Exercise.name.ilike(f"%{_escape_like(w)}%", escape="\\") for w in words]
    if equipment:
        conditions.append(Exercise.equipment == equipment)
    if category:
        conditions.append(Exercise.category == category)
    if muscle:
        conditions.append(
            Exercise.muscles.any(
                (ExerciseMuscle.role == MuscleRole.PRIMARY)
                & ExerciseMuscle.muscle.has(Muscle.name == muscle)
            )
        )

    total = await session.scalar(select(func.count()).select_from(Exercise).where(*conditions))

    order_by: list[ColumnElement[object]] = []
    if q:
        # Names starting with the query rank first ("curl" → "Curl…" before "Preacher Curl").
        starts_with = Exercise.name.ilike(f"{_escape_like(q.strip())}%", escape="\\")
        order_by.append(case((starts_with, 0), else_=1))
    stmt = (
        select(Exercise)
        .where(*conditions)
        .order_by(*order_by, Exercise.name, Exercise.id)
        .limit(limit)
        .offset(offset)
    )
    exercises = (await session.scalars(_with_muscles(stmt))).all()
    return ExercisePage(
        items=[ExerciseSummary.from_model(ex) for ex in exercises],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/exercises/filters", response_model=ExerciseFilters)
async def exercise_filters(session: Session, user_id: OptionalUserId) -> ExerciseFilters:
    visible = _visible_to(user_id)

    async def distinct(column: InstrumentedAttribute[str | None]) -> list[str]:
        rows = await session.scalars(
            select(column).distinct().where(visible, column.is_not(None)).order_by(column)
        )
        return [r for r in rows if r is not None]

    muscles = await session.scalars(select(Muscle.name).order_by(Muscle.name))
    return ExerciseFilters(
        muscles=list(muscles),
        equipment=await distinct(Exercise.equipment),
        categories=await distinct(Exercise.category),
    )


@router.get("/exercises/{exercise_id}", response_model=ExerciseDetail)
async def get_exercise(
    exercise_id: int, session: Session, user_id: OptionalUserId
) -> ExerciseDetail:
    stmt = select(Exercise).where(Exercise.id == exercise_id, _visible_to(user_id))
    exercise = await session.scalar(_with_muscles(stmt))
    if exercise is None:
        # Also for someone else's custom exercise: don't reveal that it exists.
        raise HTTPException(status_code=404, detail="Exercise not found")
    return ExerciseDetail.from_model(exercise)
