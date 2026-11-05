from fastapi import APIRouter

from app import __version__
from app.deps import Context
from app.schemas import Health

router = APIRouter(tags=["health"])


@router.get("/health", response_model=Health, summary="Liveness and capabilities")
def health(context: Context) -> Health:
    return Health(
        status="ok",
        version=__version__,
        engine=context.engine.available(),
        puzzles=len(context.puzzles),
    )
