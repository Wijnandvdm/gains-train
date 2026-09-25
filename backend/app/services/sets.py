"""What counts as a performed set, defined once for history totals and stats."""

from sqlalchemy import ColumnElement, and_, or_

from app.models import Workout, WorkoutSet


def performed_set() -> ColumnElement[bool]:
    """A set that was actually done: it has weight and reps, isn't a warm-up, and was
    either ticked off in a live workout or came from an import (which has no timestamps).

    Queries using this must join WorkoutSet → WorkoutExercise → Workout.
    """
    return and_(
        WorkoutSet.weight_kg.is_not(None),
        WorkoutSet.reps.is_not(None),
        WorkoutSet.is_warmup.is_(False),
        or_(WorkoutSet.completed_at.is_not(None), Workout.import_key.is_not(None)),
    )
