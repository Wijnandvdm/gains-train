import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey
from app.models.exercise import Exercise


class Routine(UUIDPrimaryKey, Timestamps, Base):
    """A user's training plan: days done in rotation (Day1 → Day2 → Day3 → Day1 …)."""

    __tablename__ = "routines"

    # One routine per user (for now).
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )

    days: Mapped[list["RoutineDay"]] = relationship(
        back_populates="routine", cascade="all, delete-orphan", order_by="RoutineDay.position"
    )


class RoutineDay(UUIDPrimaryKey, Base):
    """One day of the rotation. Workouts link to it (so its id must stay stable on edits)."""

    __tablename__ = "routine_days"

    routine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("routines.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(200))

    routine: Mapped[Routine] = relationship(back_populates="days")
    exercises: Mapped[list["RoutineExercise"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="RoutineExercise.position"
    )


class RoutineExercise(UUIDPrimaryKey, Base):
    __tablename__ = "routine_exercises"
    __table_args__ = (CheckConstraint("sets BETWEEN 1 AND 20", name="sets_range"),)

    day_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("routine_days.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    exercise_id: Mapped[int] = mapped_column(
        # A routine is a plan, not history: a deleted exercise simply drops out of it.
        ForeignKey("exercises.id", ondelete="CASCADE"),
        index=True,
    )
    # How many work sets are planned.
    sets: Mapped[int] = mapped_column(Integer, default=3)

    day: Mapped[RoutineDay] = relationship(back_populates="exercises")
    exercise: Mapped[Exercise] = relationship()
