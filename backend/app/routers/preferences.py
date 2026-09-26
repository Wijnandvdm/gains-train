from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.db import get_session
from app.models import Exercise, ExercisePreference
from app.schemas.preference import ExercisePreferenceIn, ExercisePreferenceOut
from app.services.exercises import visible_to

router = APIRouter(prefix="/api/exercise-preferences", tags=["preferences"])

Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=list[ExercisePreferenceOut])
async def list_exercise_preferences(
    user: CurrentUser, session: Session
) -> list[ExercisePreferenceOut]:
    """All your per-exercise settings (only the exercises you changed something for)."""
    prefs = await session.scalars(
        select(ExercisePreference).where(ExercisePreference.user_id == user.id)
    )
    return [ExercisePreferenceOut.model_validate(p) for p in prefs]


@router.put("/{exercise_id}", response_model=ExercisePreferenceOut)
async def save_exercise_preference(
    exercise_id: int, body: ExercisePreferenceIn, user: CurrentUser, session: Session
) -> ExercisePreferenceOut:
    visible = await session.scalar(
        select(Exercise.id).where(Exercise.id == exercise_id, visible_to(user.id))
    )
    if visible is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
    stmt = insert(ExercisePreference).values(
        user_id=user.id, exercise_id=exercise_id, rest_seconds=body.rest_seconds
    )
    await session.execute(
        stmt.on_conflict_do_update(
            index_elements=[ExercisePreference.user_id, ExercisePreference.exercise_id],
            set_={"rest_seconds": stmt.excluded.rest_seconds},
        )
    )
    await session.commit()
    return ExercisePreferenceOut(exercise_id=exercise_id, rest_seconds=body.rest_seconds)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def reset_exercise_preference(exercise_id: int, user: CurrentUser, session: Session) -> None:
    """Back to the automatic rest time. Idempotent."""
    await session.execute(
        delete(ExercisePreference).where(
            ExercisePreference.user_id == user.id, ExercisePreference.exercise_id == exercise_id
        )
    )
    await session.commit()
