"""Runtime configuration read from environment variables.

| Variable            | Default                  | Meaning                                        |
|---------------------|--------------------------|------------------------------------------------|
| ``CORS_ORIGINS``    | ``*``                    | comma-separated allowed origins                |
| ``PUZZLES_PATH``    | ``app/data/puzzles.json``| puzzle file served by ``/api/puzzles``         |
| ``STOCKFISH_PATH``  | auto-discovery           | Stockfish binary (else PATH, /usr/games, ...)  |
| ``ENGINE_ENABLED``  | ``true``                 | ``false`` turns ``/api/analysis`` into a 503   |
| ``ENGINE_POOL_SIZE``| ``1``                    | concurrent Stockfish processes                 |
| ``ENGINE_THREADS``  | ``1``                    | UCI ``Threads`` per process                    |
| ``ENGINE_HASH_MB``  | ``32``                   | UCI ``Hash`` per process                       |
| ``ENGINE_MAX_TIME`` | ``1.0``                  | seconds cap per analysed position (0 = none)   |
| ``ENGINE_WAIT``     | ``20``                   | seconds to wait for a busy engine before 503   |
"""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final

LOG = logging.getLogger(__name__)

PACKAGE_DIR: Final = Path(__file__).resolve().parent
DEFAULT_PUZZLES_PATH: Final = PACKAGE_DIR / "data" / "puzzles.json"

_TRUE: Final = frozenset({"1", "true", "yes", "on"})
_FALSE: Final = frozenset({"0", "false", "no", "off"})


def parse_origins(value: str | None) -> tuple[str, ...]:
    """Split ``CORS_ORIGINS``; an empty value means "allow every origin"."""
    if value is None:
        return ("*",)
    origins = tuple(dict.fromkeys(part.strip().rstrip("/") for part in value.split(",") if part.strip()))
    return origins or ("*",)


def _parse_bool(name: str, value: str | None, default: bool) -> bool:
    if value is None or not value.strip():
        return default
    lowered = value.strip().lower()
    if lowered in _TRUE:
        return True
    if lowered in _FALSE:
        return False
    LOG.warning("ignoring invalid %s=%r (expected true/false)", name, value)
    return default


def _parse_number[N: (int, float)](
    name: str,
    value: str | None,
    default: N,
    kind: type[N],
    low: N,
    high: N,
) -> N:
    if value is None or not value.strip():
        return default
    try:
        parsed = kind(value.strip())
    except ValueError:
        LOG.warning("ignoring invalid %s=%r", name, value)
        return default
    return min(max(parsed, low), high)


@dataclass(frozen=True, slots=True)
class Settings:
    cors_origins: tuple[str, ...] = ("*",)
    puzzles_path: Path = DEFAULT_PUZZLES_PATH
    stockfish_path: str | None = None
    """Explicit binary; ``None`` means auto-discovery."""
    engine_enabled: bool = True
    engine_pool_size: int = 1
    engine_threads: int = 1
    engine_hash_mb: int = 32
    engine_max_time: float = 1.0
    engine_wait: float = 20.0

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> Settings:
        env = os.environ if environ is None else environ
        puzzles_path = env.get("PUZZLES_PATH", "").strip()
        stockfish_path = env.get("STOCKFISH_PATH", "").strip()
        return cls(
            cors_origins=parse_origins(env.get("CORS_ORIGINS")),
            puzzles_path=Path(puzzles_path) if puzzles_path else DEFAULT_PUZZLES_PATH,
            stockfish_path=stockfish_path or None,
            engine_enabled=_parse_bool("ENGINE_ENABLED", env.get("ENGINE_ENABLED"), default=True),
            engine_pool_size=_parse_number("ENGINE_POOL_SIZE", env.get("ENGINE_POOL_SIZE"), 1, int, 1, 8),
            engine_threads=_parse_number("ENGINE_THREADS", env.get("ENGINE_THREADS"), 1, int, 1, 64),
            engine_hash_mb=_parse_number("ENGINE_HASH_MB", env.get("ENGINE_HASH_MB"), 32, int, 1, 4096),
            engine_max_time=_parse_number(
                "ENGINE_MAX_TIME",
                env.get("ENGINE_MAX_TIME"),
                1.0,
                float,
                0.0,
                60.0,
            ),
            engine_wait=_parse_number("ENGINE_WAIT", env.get("ENGINE_WAIT"), 20.0, float, 0.0, 600.0),
        )
