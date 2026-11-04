import chess
import pytest

from matesearch import MateSearch, SearchLimitError, find_mate

BACK_RANK = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"
MORPHY = "kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1"  # 1.Ra6! bxa6 2.b7#
QUEEN_CORNER = "k7/8/1K6/8/8/8/8/7Q w - - 0 1"  # Qb7# or Qh8#
# Lichess puzzle 001wR (CC0): setup b7b5, then 1.Qa5+ Kb7 2.Nd6+ Kb8 3.Qd8#
LICHESS_START = "6nr/pp3p1p/k1p5/8/1QN5/2P1P3/4KPqP/8 b - - 5 26"
LICHESS_SETUP = "b7b5"
BARE_KINGS = "8/8/8/4k3/8/8/8/4K3 w - - 0 1"


def uci(moves: list[chess.Move]) -> list[str]:
    return [move.uci() for move in moves]


def lichess_mate_in_3() -> chess.Board:
    board = chess.Board(LICHESS_START)
    board.push_uci(LICHESS_SETUP)
    return board


def test_mate_in_one() -> None:
    board = chess.Board(BACK_RANK)
    search = MateSearch()
    assert search.shortest_mate(board, 3) == 1
    assert uci(search.mating_moves(board, 1)) == ["a1a8"]


def test_several_mates_in_one() -> None:
    board = chess.Board(QUEEN_CORNER)
    assert uci(MateSearch().mating_moves(board, 1)) == ["h1b7", "h1h8"]


def test_morphy_mate_in_two() -> None:
    board = chess.Board(MORPHY)
    search = MateSearch()
    assert not search.mates_in(board, 1)
    assert search.shortest_mate(board, 3) == 2
    assert uci(search.mating_moves(board, 2)) == ["a1a6"]
    board.push_uci("a1a6")
    assert search.always_mated(board, 1)
    defence = search.best_defence(board, 1)
    assert defence is not None
    board.push(defence)
    assert search.mates_in(board, 1)


def test_lichess_mate_in_three() -> None:
    board = lichess_mate_in_3()
    search = MateSearch()
    assert search.shortest_mate(board, 3) == 3
    assert chess.Move.from_uci("b4a5") in search.mating_moves(board, 3)
    assert find_mate(board, 2) is None


def test_no_mate_and_stalemate() -> None:
    assert find_mate(chess.Board(BARE_KINGS), 3) is None
    stalemate = chess.Board("7k/8/6QK/8/8/8/8/8 b - - 0 1")
    assert stalemate.is_stalemate()
    assert not MateSearch().always_mated(stalemate, 2)
    mated = chess.Board("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1")
    assert mated.is_checkmate()
    assert MateSearch().always_mated(mated, 1)


def test_node_limit() -> None:
    with pytest.raises(SearchLimitError):
        MateSearch(node_limit=5).shortest_mate(lichess_mate_in_3(), 3)


def test_search_leaves_the_board_unchanged() -> None:
    board = lichess_mate_in_3()
    before = board.fen()
    MateSearch().mating_moves(board, 3)
    assert board.fen() == before
