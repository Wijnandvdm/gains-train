import uuid

from sqlalchemy import ColumnElement, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.interfaces import LoaderOption

from app.models import Exercise, ExerciseMuscle


def visible_to(user_id: uuid.UUID | None) -> ColumnElement[bool]:
    """Library exercises are visible to everyone; custom ones only to their owner."""
    if user_id is None:
        return Exercise.owner_id.is_(None)
    return or_(Exercise.owner_id.is_(None), Exercise.owner_id == user_id)


def load_muscles() -> LoaderOption:
    """Loader option for Exercise.muscles (+ names), which ExerciseSummary needs.

    Async sessions can't lazy-load, so relationships must be loaded up front.
    """
    return selectinload(Exercise.muscles).selectinload(ExerciseMuscle.muscle)
