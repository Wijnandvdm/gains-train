import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps


class MuscleRole(enum.StrEnum):
    PRIMARY = "primary"
    SECONDARY = "secondary"


class Muscle(Base):
    __tablename__ = "muscles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)


class Exercise(Timestamps, Base):
    """An exercise from the shared library (owner_id is NULL) or a user's custom exercise."""

    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Stable identifier; for library exercises this is the free-exercise-db id.
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    equipment: Mapped[str | None] = mapped_column(String(50))
    category: Mapped[str | None] = mapped_column(String(50))
    level: Mapped[str | None] = mapped_column(String(20))
    mechanic: Mapped[str | None] = mapped_column(String(20))
    force: Mapped[str | None] = mapped_column(String(20))
    instructions: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    image_paths: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")

    muscles: Mapped[list["ExerciseMuscle"]] = relationship(
        back_populates="exercise", cascade="all, delete-orphan"
    )

    @property
    def is_custom(self) -> bool:
        return self.owner_id is not None


# A user can't have two custom exercises with the same name (case-insensitive).
Index(
    "uq_exercises_owner_id_lower_name",
    Exercise.owner_id,
    func.lower(Exercise.name),
    unique=True,
    postgresql_where=Exercise.owner_id.is_not(None),
)


class ExerciseMuscle(Base):
    __tablename__ = "exercise_muscles"

    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True
    )
    muscle_id: Mapped[int] = mapped_column(
        ForeignKey("muscles.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[MuscleRole] = mapped_column(
        Enum(
            MuscleRole,
            native_enum=False,
            create_constraint=True,
            length=20,
            name="role",
            values_callable=lambda e: [m.value for m in e],
        )
    )

    exercise: Mapped[Exercise] = relationship(back_populates="muscles")
    muscle: Mapped[Muscle] = relationship()
