"""Shared request dependencies and helpers for the routers."""

import secrets
from dataclasses import dataclass
from typing import Annotated, Any, Final

from fastapi import Depends, Query, Request
from fastapi.exceptions import RequestValidationError

from app.config import Settings
from app.services.engine import EnginePool
from app.services.puzzles import PuzzleStore

SEED_MAX: Final = 2**53 - 1
"""Largest seed accepted (JavaScript's ``Number.MAX_SAFE_INTEGER``)."""


@dataclass(frozen=True, slots=True)
class AppContext:
    settings: Settings
    puzzles: PuzzleStore
    engine: EnginePool


def get_context(request: Request) -> AppContext:
    context = request.app.state.context
    if not isinstance(context, AppContext):  # pragma: no cover - wiring error
        msg = "application context is missing"
        raise TypeError(msg)
    return context


Context = Annotated[AppContext, Depends(get_context)]
SeedQuery = Annotated[
    int | None,
    Query(ge=0, le=SEED_MAX, description="Seed for reproducible results; random when omitted"),
]


def resolve_seed(seed: int | None) -> int:
    return secrets.randbelow(2**31) if seed is None else seed


def validation_error(location: tuple[str | int, ...], message: str, value: Any) -> RequestValidationError:
    """A 422 error shaped like FastAPI's own validation errors."""
    return RequestValidationError(
        [{"type": "value_error", "loc": location, "msg": message, "input": value}],
    )
