from pydantic import BaseModel

from app.models import Exercise, MuscleRole

# Where exercise images are served (see the StaticFiles mount in app/main.py).
IMAGE_URL_PREFIX = "/api/exercise-images"


class ExerciseSummary(BaseModel):
    id: int
    slug: str
    name: str
    equipment: str | None
    category: str | None
    level: str | None
    mechanic: str | None
    force: str | None
    is_custom: bool
    primary_muscles: list[str]
    secondary_muscles: list[str]
    image_urls: list[str]

    @classmethod
    def from_model(cls, ex: Exercise) -> "ExerciseSummary":
        """Requires ex.muscles (and each link's .muscle) to be loaded."""

        def muscles(role: MuscleRole) -> list[str]:
            return sorted(link.muscle.name for link in ex.muscles if link.role == role)

        return cls(
            id=ex.id,
            slug=ex.slug,
            name=ex.name,
            equipment=ex.equipment,
            category=ex.category,
            level=ex.level,
            mechanic=ex.mechanic,
            force=ex.force,
            is_custom=ex.is_custom,
            primary_muscles=muscles(MuscleRole.PRIMARY),
            secondary_muscles=muscles(MuscleRole.SECONDARY),
            image_urls=[f"{IMAGE_URL_PREFIX}/{p}" for p in ex.image_paths],
        )


class ExerciseDetail(ExerciseSummary):
    instructions: list[str]

    @classmethod
    def from_model(cls, ex: Exercise) -> "ExerciseDetail":
        summary = ExerciseSummary.from_model(ex)
        return cls(**summary.model_dump(), instructions=ex.instructions)


class ExercisePage(BaseModel):
    items: list[ExerciseSummary]
    total: int
    limit: int
    offset: int


class ExerciseFilters(BaseModel):
    """Values available for the filter chips in the exercise library."""

    muscles: list[str]
    equipment: list[str]
    categories: list[str]
