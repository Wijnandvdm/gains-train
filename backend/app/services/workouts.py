from typing import Any

from sqlalchemy import ColumnElement

from app.models import Workout


def newest_first() -> tuple[ColumnElement[Any], ...]:
    """ORDER BY for workouts, most recent first (imported workouts have no start time)."""
    return (
        Workout.performed_on.desc(),
        Workout.started_at.desc().nulls_last(),
        Workout.created_at.desc(),
    )
