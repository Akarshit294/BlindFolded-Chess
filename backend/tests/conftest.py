import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.engine import find_stockfish

FIXTURES = Path(__file__).parent / "fixtures"
SMALL_PUZZLES = FIXTURES / "puzzles_small.json"
LICHESS_SAMPLE = FIXTURES / "lichess_sample.csv"

STOCKFISH = find_stockfish(os.environ.get("STOCKFISH_PATH"))


@pytest.fixture(autouse=True)
def _skip_without_stockfish(request: pytest.FixtureRequest) -> None:
    if request.node.get_closest_marker("requires_stockfish") and STOCKFISH is None:
        pytest.skip("no Stockfish binary found (set STOCKFISH_PATH)")


@pytest.fixture(scope="session")
def stockfish_path() -> str:
    if STOCKFISH is None:
        pytest.skip("no Stockfish binary found (set STOCKFISH_PATH)")
    return STOCKFISH


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    """The real puzzle set, engine disabled."""
    with TestClient(create_app(Settings(engine_enabled=False))) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def small_client() -> Iterator[TestClient]:
    """Nine known puzzles, engine disabled."""
    settings = Settings(engine_enabled=False, puzzles_path=SMALL_PUZZLES)
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def engine_client(stockfish_path: str) -> Iterator[TestClient]:
    settings = Settings(stockfish_path=stockfish_path, engine_max_time=0)
    with TestClient(create_app(settings)) as test_client:
        yield test_client
