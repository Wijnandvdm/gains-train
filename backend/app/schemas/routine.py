import uuid
from typing import Annotated

from pydantic import BaseModel, Field

from app.schemas.exercise import ExerciseSummary

Sets = Annotated[int, Field(ge=1, le=20)]


class RoutineExerciseIn(BaseModel):
    exercise_id: int
    sets: Sets = 3


class RoutineDayIn(BaseModel):
    # Send the id of an existing day to keep it (workouts link to days by id).
    id: uuid.UUID | None = None
    name: Annotated[str, Field(min_length=1, max_length=200)]
    exercises: Annotated[list[RoutineExerciseIn], Field(max_length=30)] = []


class RoutineIn(BaseModel):
    """The whole routine; days are in rotation order."""

    days: Annotated[list[RoutineDayIn], Field(min_length=1, max_length=14)]


class RoutineExerciseOut(BaseModel):
    exercise: ExerciseSummary
    sets: int


class RoutineDayOut(BaseModel):
    id: uuid.UUID
    position: int
    name: str
    exercises: list[RoutineExerciseOut]


class RoutineOut(BaseModel):
    id: uuid.UUID
    days: list[RoutineDayOut]
    # The day after the last finished one (wrapping around).
    next_day_id: uuid.UUID | None
