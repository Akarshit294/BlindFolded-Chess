"""Integrity of the bundled puzzle files and the in-memory store."""

import json
from pathlib import Path
from typing import Any

import chess
import pytest

from app.config import DEFAULT_PUZZLES_PATH
from app.services.puzzles import PuzzleFileError, PuzzleFilter, PuzzleStore
from puzzlelib import GOALS, NOISY_THEMES, check_line, goal_for

FRONTEND_PUZZLES = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data" / "puzzles.json"
SMALL_PUZZLES = Path(__file__).parent / "fixtures" / "puzzles_small.json"


def load(path: Path) -> dict[str, Any]:
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data


@pytest.fixture(scope="module")
def backend_file() -> dict[str, Any]:
    return load(DEFAULT_PUZZLES_PATH)


@pytest.fixture(scope="module")
def frontend_file() -> dict[str, Any]:
    if not FRONTEND_PUZZLES.is_file():
        pytest.skip("frontend bundle not present")
    return load(FRONTEND_PUZZLES)


def check_file(data: dict[str, Any]) -> None:
    assert data["version"] == 1
    assert "CC0" in data["source"]
    assert data["count"] == len(data["puzzles"])
    ids = [puzzle["id"] for puzzle in data["puzzles"]]
    assert len(ids) == len(set(ids))
    ratings = [(puzzle["rating"], puzzle["id"]) for puzzle in data["puzzles"]]
    assert ratings == sorted(ratings)
    for puzzle in data["puzzles"]:
        assert set(puzzle) == {"id", "fen", "moves", "rating", "themes", "pieces", "goal"}
        line = check_line(puzzle["fen"], puzzle["moves"])
        assert line is not None, puzzle["id"]
        assert 2 <= len(puzzle["moves"]) <= 6
        assert line.pieces == puzzle["pieces"]
        assert 3 <= puzzle["pieces"] <= 16
        assert goal_for(puzzle["themes"], line) == puzzle["goal"], puzzle["id"]
        assert not NOISY_THEMES & set(puzzle["themes"])
        assert not any(theme.startswith("masterVs") for theme in puzzle["themes"])
        if puzzle["goal"] != "win":
            assert line.checkmate
            assert f"mateIn{puzzle['goal'][-1]}" in puzzle["themes"]


def test_backend_file_is_valid_and_balanced(backend_file: dict[str, Any]) -> None:
    check_file(backend_file)
    assert backend_file["count"] == 4000
    goals = [puzzle["goal"] for puzzle in backend_file["puzzles"]]
    assert {goal: goals.count(goal) for goal in GOALS} == dict.fromkeys(GOALS, 1000)


def test_frontend_file_is_a_small_balanced_subset(
    backend_file: dict[str, Any],
    frontend_file: dict[str, Any],
) -> None:
    check_file(frontend_file)
    assert FRONTEND_PUZZLES.stat().st_size < 250_000
    assert b"\n " not in FRONTEND_PUZZLES.read_bytes()  # compact JSON
    backend_ids = {puzzle["id"] for puzzle in backend_file["puzzles"]}
    assert {puzzle["id"] for puzzle in frontend_file["puzzles"]} <= backend_ids
    goals = [puzzle["goal"] for puzzle in frontend_file["puzzles"]]
    counts = {goal: goals.count(goal) for goal in GOALS}
    assert max(counts.values()) - min(counts.values()) <= 1
    assert frontend_file["count"] >= 1000


def test_store_loads_and_indexes() -> None:
    store = PuzzleStore.load(SMALL_PUZZLES)
    assert len(store) == 9
    puzzle = store.get("WYcMT")
    assert puzzle is not None
    assert store.get("missing") is None
    board = puzzle.solver_board()
    assert chess.popcount(board.occupied) == puzzle.pieces
    assert all(p.pieces == 6 for p in store.with_pieces(6))
    assert store.with_pieces(30) == ()


def test_store_filters() -> None:
    store = PuzzleStore.load(SMALL_PUZZLES)
    assert len(store.filter(PuzzleFilter())) == 9
    assert {p.goal for p in store.filter(PuzzleFilter(goal="win"))} == {"win"}
    assert all(p.rating <= 1100 for p in store.filter(PuzzleFilter(max_rating=1100)))
    assert store.filter(PuzzleFilter(min_rating=3000)) == []
    assert all("fork" in p.themes for p in store.filter(PuzzleFilter(theme="Fork")))


def test_store_paging_and_picking() -> None:
    store = PuzzleStore.load(SMALL_PUZZLES)
    total, items = store.page(PuzzleFilter(), limit=4, offset=2)
    assert total == 9
    assert [p.id for p in items] == [p.id for p in store.filter(PuzzleFilter())][2:6]
    _, shuffled = store.page(PuzzleFilter(), limit=9, seed=3)
    _, again = store.page(PuzzleFilter(), limit=9, seed=3)
    assert shuffled == again
    assert {p.id for p in shuffled} == {p.id for p in store}
    picked = store.pick(PuzzleFilter(goal="mate1"), seed=1)
    assert picked is not None
    other = store.pick(PuzzleFilter(goal="mate1"), exclude={picked.id})
    assert other is not None
    assert other.id != picked.id
    assert store.pick(PuzzleFilter(goal="mate1"), exclude={picked.id, other.id}) is None


def test_missing_file_gives_an_empty_store(tmp_path: Path) -> None:
    store = PuzzleStore.load(tmp_path / "absent.json")
    assert len(store) == 0
    assert store.meta()["rating"] == {"min": None, "max": None}


@pytest.mark.parametrize(
    "content",
    [
        "not json",
        "[]",
        '{"puzzles": [{"id": "x"}]}',
        (
            '{"puzzles": [{"id": "x", "fen": "8/8/8/8/8/8/8/8 w - - 0 1", "moves": ["a1a2", "a2a3"],'
            ' "rating": 1, "themes": [], "pieces": 3, "goal": "draw"}]}'
        ),
    ],
)
def test_malformed_files_are_rejected(tmp_path: Path, content: str) -> None:
    path = tmp_path / "bad.json"
    path.write_text(content)
    with pytest.raises(PuzzleFileError):
        PuzzleStore.load(path)
