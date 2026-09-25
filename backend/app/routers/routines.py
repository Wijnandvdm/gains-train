from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.db import get_session
from app.models import Exercise, Routine, RoutineDay, RoutineExercise, User
from app.schemas.exercise import ExerciseSummary
from app.schemas.routine import RoutineDayOut, RoutineExerciseOut, RoutineIn, RoutineOut
from app.services.exercises import visible_to
from app.services.routines import load_routine, next_day_id, routine_from_history

router = APIRouter(prefix="/api/routine", tags=["routine"])

Session = Annotated[AsyncSession, Depends(get_session)]


async def _routine_out(session: AsyncSession, user: User) -> RoutineOut | None:
    routine = await load_routine(session, user)
    if routine is None:
        return None
    return RoutineOut(
        id=routine.id,
        days=[
            RoutineDayOut(
                id=day.id,
                position=day.position,
                name=day.name,
                exercises=[
                    RoutineExerciseOut(
                        exercise=ExerciseSummary.from_model(re.exercise), sets=re.sets
                    )
                    for re in day.exercises
                ],
            )
            for day in routine.days
        ],
        next_day_id=await next_day_id(session, user, routine),
    )


@router.get("", response_model=RoutineOut | None)
async def get_routine(user: CurrentUser, session: Session) -> RoutineOut | None:
    return await _routine_out(session, user)


@router.put("", response_model=RoutineOut)
async def save_routine(body: RoutineIn, user: CurrentUser, session: Session) -> RoutineOut:
    """Replace the routine. Days sent with their existing id keep it, so workouts stay
    linked to them (and the rotation keeps its place); days left out are deleted."""
    exercise_ids = {e.exercise_id for day in body.days for e in day.exercises}
    visible = set(
        await session.scalars(
            select(Exercise.id).where(Exercise.id.in_(exercise_ids), visible_to(user.id))
        )
    )
    if missing := exercise_ids - visible:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Exercise(s) not found: {sorted(missing)}")

    routine = await session.scalar(select(Routine).where(Routine.user_id == user.id))
    if routine is None:
        routine = Routine(user_id=user.id)
        session.add(routine)
        await session.flush()
    existing = {
        day.id: day
        for day in await session.scalars(
            select(RoutineDay).where(RoutineDay.routine_id == routine.id)
        )
    }

    kept = set()
    for position, day_in in enumerate(body.days, start=1):
        day = existing.get(day_in.id) if day_in.id else None
        if day is None:
            day = RoutineDay(routine_id=routine.id)
            session.add(day)
        day.position = position
        day.name = day_in.name
        await session.flush()
        kept.add(day.id)
        # A day's exercises have no ids anyone depends on: simply replace them.
        await session.execute(delete(RoutineExercise).where(RoutineExercise.day_id == day.id))
        session.add_all(
            RoutineExercise(day_id=day.id, position=i, exercise_id=e.exercise_id, sets=e.sets)
            for i, e in enumerate(day_in.exercises, start=1)
        )
    removed = existing.keys() - kept
    if removed:
        # SQL delete: the database cascades to its exercises and unlinks its workouts.
        await session.execute(delete(RoutineDay).where(RoutineDay.id.in_(removed)))

    await session.commit()
    result = await _routine_out(session, user)
    assert result is not None
    return result


@router.post("/from-history", response_model=RoutineOut)
async def create_routine_from_history(user: CurrentUser, session: Session) -> RoutineOut:
    """Turn your named workouts (e.g. Day1/Day2/Day3) into your routine."""
    if await routine_from_history(session, user) is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "No named workouts in your history yet"
        )
    await session.commit()
    result = await _routine_out(session, user)
    assert result is not None
    return result


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(user: CurrentUser, session: Session) -> None:
    await session.execute(delete(Routine).where(Routine.user_id == user.id))
    await session.commit()
