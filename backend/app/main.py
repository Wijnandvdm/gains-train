from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.importers.free_exercise_db import IMAGES_DIR, dataset_dir
from app.routers import auth, exercises, workouts
from app.schemas.exercise import IMAGE_URL_PREFIX

app = FastAPI(
    title="gains-train API",
    # Use the function name as the OpenAPI operationId ("list_exercises" rather than
    # "list_exercises_api_exercises_get"); it shows up in the generated frontend types.
    generate_unique_id_function=lambda route: route.name,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(workouts.router)

# Exercise images from the downloaded dataset (run `python -m app.cli seed-exercises` first).
# check_dir=False: the app still starts (e.g. in tests) when the dataset isn't downloaded.
app.mount(
    IMAGE_URL_PREFIX,
    StaticFiles(directory=dataset_dir(settings.data_dir) / IMAGES_DIR, check_dir=False),
    name="exercise-images",
)


@app.get("/api/health")
async def health(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
