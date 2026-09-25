import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

from app.models import WorkoutStatus
from app.schemas.exercise import ExerciseSummary

# Stored as exact NUMERIC in the database; sent to the frontend as a plain JSON number
# (Pydantic would otherwise serialize Decimal as a string).
Kg = Annotated[
    Decimal,
    Field(ge=0, le=Decimal("9999.99"), decimal_places=2),
    PlainSerializer(float, return_type=float, when_used="json"),
]
Rpe = Annotated[
    Decimal,
    Field(ge=1, le=10, multiple_of=Decimal("0.5")),
    PlainSerializer(float, return_type=float, when_used="json"),
]
Reps = Annotated[int, Field(ge=0, le=1000)]
Name = Annotated[str, Field(min_length=1, max_length=200)]
Notes = Annotated[str, Field(max_length=5000)]


# --- Sets ---------------------------------------------------------------------------------


class SetIn(BaseModel):
    """Full state of a set (PUT semantics: fields left out are cleared)."""

    workout_exercise_id: uuid.UUID
    position: Annotated[int, Field(ge=1)]
    weight_kg: Kg | None = None
    reps: Reps | None = None
    rpe: Rpe | None = None
    is_warmup: bool = False
    notes: Notes | None = None
    # When the set was ticked off; sent by the client so offline-logged sets keep their time.
    completed_at: datetime | None = None


class SetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workout_exercise_id: uuid.UUID
    position: int
    weight_kg: Kg | None
    reps: int | None
    rpe: Rpe | None
    is_warmup: bool
    notes: str | None
    completed_at: datetime | None


# --- Workout exercises --------------------------------------------------------------------


class WorkoutExerciseIn(BaseModel):
    # Optional client-generated id, so a retried request doesn't add the exercise twice.
    id: uuid.UUID | None = None
    exercise_id: int
    notes: Notes | None = None


class WorkoutExerciseOut(BaseModel):
    id: uuid.UUID
    position: int
    notes: str | None
    exercise: ExerciseSummary
    sets: list[SetOut]


class ExerciseOrder(BaseModel):
    """All of the workout's exercise ids, in the new order."""

    workout_exercise_ids: list[uuid.UUID]


# --- Workouts -----------------------------------------------------------------------------


class WorkoutCreate(BaseModel):
    # Optional client-generated id: retrying the same request returns the same workout.
    id: uuid.UUID | None = None
    name: Name | None = None
    # The client's local date; defaults to the server's date.
    performed_on: date | None = None
    started_at: datetime | None = None
    # When doing a day of your routine (decides which day is up next).
    routine_day_id: uuid.UUID | None = None


class WorkoutUpdate(BaseModel):
    """Only the fields that are sent are changed."""

    name: Name | None = None
    notes: Notes | None = None
    performed_on: date | None = None


class WorkoutFinish(BaseModel):
    ended_at: datetime | None = None


class WorkoutSummary(BaseModel):
    id: uuid.UUID
    name: str | None
    routine_day_id: uuid.UUID | None
    performed_on: date
    status: WorkoutStatus
    started_at: datetime | None
    ended_at: datetime | None
    exercise_names: list[str]
    set_count: int
    # Sum of weight × reps over the sets that count (see app/services/sets.py).
    volume_kg: float


class WorkoutPage(BaseModel):
    items: list[WorkoutSummary]
    total: int
    limit: int
    offset: int


class WorkoutDetail(BaseModel):
    id: uuid.UUID
    name: str | None
    routine_day_id: uuid.UUID | None
    performed_on: date
    status: WorkoutStatus
    started_at: datetime | None
    ended_at: datetime | None
    notes: str | None
    exercises: list[WorkoutExerciseOut]


# --- Exercise history ---------------------------------------------------------------------


class ExerciseSession(BaseModel):
    """One past workout's sets for a single exercise (for "last time" hints)."""

    workout_id: uuid.UUID
    workout_name: str | None
    performed_on: date
    sets: list[SetOut]
