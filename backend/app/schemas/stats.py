import uuid
from datetime import date

from pydantic import BaseModel

from app.schemas.exercise import ExerciseSummary

# Weights, e1RMs and volumes are sent as plain numbers, rounded to 0.01 kg.


class SetRecordOut(BaseModel):
    weight_kg: float
    reps: int
    performed_on: date


class RecordsOut(BaseModel):
    heaviest: SetRecordOut
    best_e1rm: SetRecordOut
    best_e1rm_kg: float
    best_session_volume_kg: float
    best_session_volume_on: date
    # Most reps at each weight, heaviest first (only records no heavier weight matches).
    rep_records: list[SetRecordOut]


class SessionPoint(BaseModel):
    workout_id: uuid.UUID
    performed_on: date
    top_weight_kg: float
    top_weight_reps: int
    best_e1rm_kg: float
    volume_kg: float
    set_count: int


class ExerciseStats(BaseModel):
    records: RecordsOut | None  # None until the exercise has been done
    sessions: list[SessionPoint]  # oldest first


class ExerciseOverviewOut(BaseModel):
    exercise: ExerciseSummary
    sets_logged: int
    last_performed_on: date
    last_top_weight_kg: float
    max_weight_kg: float
    best_e1rm_kg: float
    total_volume_kg: float
