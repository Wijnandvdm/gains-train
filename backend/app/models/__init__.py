# Import every model here so Base.metadata knows all tables (needed by Alembic autogenerate).
from app.models.base import Base
from app.models.exercise import Exercise, ExerciseMuscle, Muscle, MuscleRole
from app.models.user import User
from app.models.workout import Workout, WorkoutExercise, WorkoutSet, WorkoutStatus

__all__ = [
    "Base",
    "Exercise",
    "ExerciseMuscle",
    "Muscle",
    "MuscleRole",
    "User",
    "Workout",
    "WorkoutExercise",
    "WorkoutSet",
    "WorkoutStatus",
]
