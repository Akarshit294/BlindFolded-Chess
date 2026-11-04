import random
from collections import Counter

import chess
import pytest

from app.services.sequence import choose_move, exchange_loss, generate_game, score_move


@pytest.mark.parametrize("plies", [2, 3, 10, 25, 40])
def test_games_have_exactly_the_requested_plies(plies: int) -> None:
    for seed in range(10):
        game = generate_game(plies, seed)
        assert len(game.moves) == len(game.san) == plies
        board = chess.Board()
        for move, san in zip(game.moves, game.san, strict=True):
            assert board.san(move) == san
            board.push(move)
        assert board.fen() == game.board.fen()
        assert not board.is_game_over()


def test_games_are_deterministic_per_seed() -> None:
    assert generate_game(30, 1234).moves == generate_game(30, 1234).moves
    distinct = {generate_game(12, seed).moves for seed in range(20)}
    assert len(distinct) > 15


def test_openings_look_natural() -> None:
    first_moves = Counter(generate_game(2, seed).san[0] for seed in range(200))
    common = {"e4", "d4", "c4", "Nf3", "Nc3", "e3", "d3", "c3", "g3", "b3"}
    assert sum(first_moves[move] for move in common) >= 180
    assert first_moves["e4"] + first_moves["d4"] >= 60


def test_no_early_king_walks_or_queen_sorties() -> None:
    king_walks = queen_moves = 0
    for seed in range(100):
        board = chess.Board()
        for move in generate_game(12, seed).moves:
            piece = board.piece_type_at(move.from_square)
            if piece == chess.KING and not board.is_castling(move):
                king_walks += 1
            if piece == chess.QUEEN and not board.is_capture(move):
                queen_moves += 1
            board.push(move)
    assert king_walks <= 3
    assert queen_moves <= 30  # out of 1200 plies


def test_never_ends_the_game_early() -> None:
    # Fool's mate is available: the policy must not play Qh4#.
    board = chess.Board()
    for uci in ("f2f3", "e7e5", "g2g4"):
        board.push_uci(uci)
    mate = chess.Move.from_uci("d8h4")
    assert score_move(board, mate) is None
    rng = random.Random(0)
    assert all(choose_move(board, rng) != mate for _ in range(200))


def test_captures_and_recaptures_are_preferred() -> None:
    # 1.e4 d5 2.exd5: recapturing with the queen is natural.
    board = chess.Board()
    for uci in ("e2e4", "d7d5", "e4d5"):
        board.push_uci(uci)
    recapture = score_move(board, chess.Move.from_uci("d8d5"), prev_capture=True)
    quiet = score_move(board, chess.Move.from_uci("a7a6"), prev_capture=True)
    assert recapture is not None
    assert quiet is not None
    assert recapture > quiet


def test_exchange_loss() -> None:
    board = chess.Board("4k3/8/8/3q4/4P3/8/8/4K3 b - - 0 1")
    assert exchange_loss(board, chess.D5, chess.BLACK) == 9.0  # attacked, undefended
    board = chess.Board("4k3/8/2p5/3n4/4P3/8/8/4K3 b - - 0 1")
    assert exchange_loss(board, chess.D5, chess.BLACK) == 2.0  # knight for a pawn
    assert exchange_loss(board, chess.E4, chess.WHITE) == 0.0  # not attacked
