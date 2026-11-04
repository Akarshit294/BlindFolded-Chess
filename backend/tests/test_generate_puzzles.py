import json
import random
from pathlib import Path

import chess
import pytest

from generate_puzzles import (
    GeneratorConfig,
    build_mate_line,
    generate,
    main,
    make_entry,
    random_setup_position,
)
from matesearch import MateSearch
from puzzlelib import check_line, goal_for


def test_random_setup_positions_are_legal() -> None:
    rng = random.Random(1)
    for _ in range(200):
        board = random_setup_position(rng)
        assert board.is_valid()
        assert not board.is_game_over()
        assert 3 <= chess.popcount(board.occupied) <= 9


def test_mate_line_for_morphy() -> None:
    board = chess.Board("kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1")
    line = build_mate_line(MateSearch(), board, 2)
    assert line is not None
    assert [move.uci() for move in line] == ["a1a6", "b7a6", "b6b7"]


def test_ambiguous_mate_in_one_is_rejected() -> None:
    board = chess.Board("k7/8/1K6/8/8/8/8/7Q w - - 0 1")  # Qb7# and Qh8#
    assert build_mate_line(MateSearch(), board, 1) is None


def test_make_entry_produces_a_verified_puzzle() -> None:
    start = chess.Board("6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1")
    moves = [chess.Move.from_uci("g8h8"), chess.Move.from_uci("a1a8")]
    entry = make_entry(start, moves, "mate1", [])
    assert entry is not None
    assert entry.id.startswith("g")
    assert entry.goal == "mate1"
    assert entry.themes == ("endgame", "mateIn1")
    assert 600 <= entry.rating <= 2400
    assert make_entry(start, moves, "mate2", []) is None  # wrong claim


def test_pure_python_generation() -> None:
    config = GeneratorConfig(max_mate=1, time_budget=60)
    entries = generate(4, seed=7, engine_path=None, config=config)
    assert len(entries) == 4
    assert {entry.goal for entry in entries} == {"mate1"}
    for entry in entries:
        line = check_line(entry.fen, entry.moves)
        assert line is not None
        assert line.checkmate
        assert goal_for(entry.themes, line) == "mate1"
    assert entries == generate(4, seed=7, engine_path=None, config=config)


@pytest.mark.requires_stockfish
def test_engine_assisted_generation(stockfish_path: str) -> None:
    config = GeneratorConfig(max_mate=2, time_budget=120)
    entries = generate(6, seed=3, engine_path=stockfish_path, config=config)
    assert len(entries) == 6
    assert {entry.goal for entry in entries} <= {"mate1", "mate2", "win"}
    for entry in entries:
        line = check_line(entry.fen, entry.moves)
        assert line is not None
        assert goal_for(entry.themes, line) == entry.goal


def test_main_writes_files(tmp_path: Path) -> None:
    backend = tmp_path / "puzzles.json"
    frontend = tmp_path / "front.json"
    argv = ["--no-engine", "--max-mate", "1", "--count", "3", "--frontend-count", "2", "--seed", "5"]
    argv += ["--output", str(backend), "--frontend-output", str(frontend), "--time-budget", "60"]
    assert main(argv) == 0
    data = json.loads(backend.read_text())
    assert data["count"] == 3
    assert "Generated" in data["source"]
    assert json.loads(frontend.read_text())["count"] == 2
