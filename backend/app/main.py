"""FastAPI application factory. Run with ``uvicorn app.main:app``."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.config import Settings
from app.deps import AppContext
from app.routers import analysis, drills, health, puzzles
from app.services.engine import EnginePool, EngineUnavailableError, find_stockfish
from app.services.puzzles import PuzzleStore

LOG = logging.getLogger(__name__)

DESCRIPTION = """\
Backend of the open-source (GPL-3.0) blindfold chess trainer: curated puzzles
from the Lichess puzzle database (CC0), engine-free visualisation drills and
Stockfish game analysis. All routes live under `/api`.
"""


async def _engine_unavailable(_: Request, exc: Exception) -> JSONResponse:
    LOG.warning("analysis refused: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "engine unavailable"})


async def _internal_error(_: Request, exc: Exception) -> JSONResponse:
    LOG.error("unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "internal server error"})


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    store = PuzzleStore.load(settings.puzzles_path)
    engine_path = find_stockfish(settings.stockfish_path) if settings.engine_enabled else None
    engine = EnginePool(
        engine_path,
        size=settings.engine_pool_size,
        threads=settings.engine_threads,
        hash_mb=settings.engine_hash_mb,
        wait=settings.engine_wait,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            engine.close()

    app = FastAPI(
        title="Blindfold Chess API",
        version=__version__,
        description=DESCRIPTION,
        license_info={"name": "GPL-3.0", "url": "https://www.gnu.org/licenses/gpl-3.0.html"},
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.context = AppContext(settings=settings, puzzles=store, engine=engine)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    for module in (health, puzzles, drills, analysis):
        app.include_router(module.router, prefix="/api")
    app.add_exception_handler(EngineUnavailableError, _engine_unavailable)
    app.add_exception_handler(Exception, _internal_error)

    @app.get("/", include_in_schema=False)
    def index() -> dict[str, str]:
        return {
            "name": "Blindfold Chess API",
            "version": __version__,
            "docs": "/api/docs",
            "health": "/api/health",
        }

    return app


app = create_app()
