import random
from pathlib import Path

import chess
import pytest

from app.services.positions import describe, drill_position, random_position, simulated_position
from app.services.puzzles import PuzzleStore

SMALL_PUZZLES = Path(__file__).parent / "fixtures" / "puzzles_small.json"


def test_description_matches_the_documented_example() -> None:
    board = chess.Board("3r2k1/pp6/8/8/8/8/PP6/3Q1RK1 w - - 0 1")
    assert describe(board) == "White: Kg1, Qd1, Rf1, pawns a2 b2. Black: Kg8, Rd8, pawns a7 b7."


def test_description_of_the_initial_position() -> None:
    assert describe(chess.Board()) == (
        "White: Ke1, Qd1, Ra1, Rh1, Bc1, Bf1, Nb1, Ng1, pawns a2 b2 c2 d2 e2 f2 g2 h2. "
        "Black: Ke8, Qd8, Ra8, Rh8, Bc8, Bf8, Nb8, Ng8, pawns a7 b7 c7 d7 e7 f7 g7 h7."
    )


def test_description_sorts_by_file_then_rank_and_handles_single_pawns() -> None:
    board = chess.Board("R7/8/8/8/8/2p5/8/RR2K2k b - - 0 1")
    assert describe(board) == "White: Ke1, Ra1, Ra8, Rb1. Black: Kh1, pawn c3."


def test_description_omits_empty_groups() -> None:
    assert describe(chess.Board("8/8/8/4k3/8/8/8/4K3 w - - 0 1")) == "White: Ke1. Black: Ke5."


@pytest.mark.parametrize("pieces", [2, 3, 4, 9, 16, 17, 24, 31, 32])
def test_random_positions_are_legal(pieces: int) -> None:
    for seed in range(15):
        board = random_position(random.Random(seed), pieces)
        assert chess.popcount(board.occupied) == pieces
        assert board.is_valid()
        assert any(board.generate_legal_moves())
        assert not board.pieces_mask(chess.PAWN, chess.WHITE) & (chess.BB_RANK_1 | chess.BB_RANK_8)
        assert not board.pieces_mask(chess.PAWN, chess.BLACK) & (chess.BB_RANK_1 | chess.BB_RANK_8)


def test_random_position_validates_count() -> None:
    with pytest.raises(ValueError, match="pieces"):
        random_position(random.Random(1), 33)


@pytest.mark.parametrize("pieces", [30, 24, 20])
def test_simulated_positions_reach_the_target(pieces: int) -> None:
    board = simulated_position(random.Random(3), pieces)
    assert board is not None
    assert chess.popcount(board.occupied) == pieces
    assert board.is_valid()


def test_drill_prefers_puzzle_positions() -> None:
    store = PuzzleStore.load(SMALL_PUZZLES)
    position = drill_position(random.Random(5), 6, store)
    assert position.source == "puzzle"
    solver_fens = {puzzle.solver_board().fen() for puzzle in store.with_pieces(6)}
    assert position.board.fen() in solver_fens


def test_drill_falls_back_to_games_then_random() -> None:
    store = PuzzleStore([])
    game = drill_position(random.Random(5), 28, store)
    assert game.source == "game"
    assert chess.popcount(game.board.occupied) == 28
    for pieces in (3, 5):  # too few to trade down to quickly: straight to random
        fallback = drill_position(random.Random(5), pieces, None)
        assert fallback.source == "random"
        assert chess.popcount(fallback.board.occupied) == pieces
        assert fallback.board.is_valid()
    assert drill_position(random.Random(5), 6, store).source == "game"


def test_drill_is_deterministic() -> None:
    store = PuzzleStore.load(SMALL_PUZZLES)
    for pieces in (6, 12, 20):
        first = drill_position(random.Random(99), pieces, store)
        second = drill_position(random.Random(99), pieces, store)
        assert first.board.fen() == second.board.fen()
