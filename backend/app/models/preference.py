import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps


class ExercisePreference(Timestamps, Base):
    """A user's own settings for one exercise. Only exists once they change something."""

    __tablename__ = "exercise_preferences"
    __table_args__ = (CheckConstraint("rest_seconds BETWEEN 0 AND 900", name="rest_range"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True
    )
    # Rest after each set; 0 = no rest timer for this exercise.
    rest_seconds: Mapped[int] = mapped_column(Integer)
