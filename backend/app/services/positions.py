"""Position-visualisation drill: realistic positions and their spoken description."""

from __future__ import annotations

import random
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Final, Literal, Protocol

import chess

from app.services.sequence import choose_move

MIN_PIECES: Final = 3
MAX_PIECES: Final = 32
DESCRIPTION_ORDER: Final = (chess.KING, chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT)
# Non-king material of one side in the initial position.
STANDARD_SET: Final = (
    (chess.QUEEN,) + (chess.ROOK,) * 2 + (chess.BISHOP,) * 2 + (chess.KNIGHT,) * 2 + (chess.PAWN,) * 8
)
SIMULATION_ATTEMPTS: Final = 4
SIMULATION_MAX_PLIES: Final = 160
SIMULATION_MIN_PLIES: Final = 8
STOP_PROBABILITY: Final = 0.5
TRADE_BIAS: Final = 2.5

PositionSource = Literal["puzzle", "game", "random"]


@dataclass(frozen=True, slots=True)
class DrillPosition:
    board: chess.Board
    source: PositionSource


class HasSolverBoard(Protocol):
    @property
    def id(self) -> str: ...

    def solver_board(self) -> chess.Board: ...


class SolverPositions(Protocol):
    """Anything that lists puzzles by piece count (the puzzle store)."""

    def with_pieces(self, pieces: int) -> Sequence[HasSolverBoard]: ...


def sorted_squares(squares: Iterable[chess.Square]) -> list[chess.Square]:
    """Squares ordered by file, then rank (a1, a2, ..., b1, ...)."""
    return sorted(squares, key=lambda square: (chess.square_file(square), chess.square_rank(square)))


def describe_side(board: chess.Board, color: chess.Color) -> str:
    parts = [
        f"{chess.piece_symbol(piece_type).upper()}{chess.square_name(square)}"
        for piece_type in DESCRIPTION_ORDER
        for square in sorted_squares(board.pieces(piece_type, color))
    ]
    pawns = sorted_squares(board.pieces(chess.PAWN, color))
    if pawns:
        label = "pawn" if len(pawns) == 1 else "pawns"
        parts.append(f"{label} " + " ".join(chess.square_name(square) for square in pawns))
    name = "White" if color == chess.WHITE else "Black"
    return f"{name}: {', '.join(parts) if parts else 'no pieces'}."


def describe(board: chess.Board) -> str:
    """E.g. ``White: Kg1, Qd1, Rf1, pawns a2 b2. Black: Kg8, Rd8, pawns a7 b7.``"""
    return f"{describe_side(board, chess.WHITE)} {describe_side(board, chess.BLACK)}"


def _playable(board: chess.Board) -> bool:
    return board.is_valid() and any(board.generate_legal_moves())


def random_position(rng: random.Random, pieces: int) -> chess.Board:
    """A random legal position with ``pieces`` pieces drawn from the standard set.

    Both kings are present, the side not to move is not in check, no pawn stands
    on the first or last rank, and the side to move has a legal move.
    """
    if not 2 <= pieces <= MAX_PIECES:
        msg = f"pieces must be between 2 and {MAX_PIECES}"
        raise ValueError(msg)
    pool = [(color, piece_type) for color in chess.COLORS for piece_type in STANDARD_SET]
    for _ in range(10_000):
        board = chess.Board.empty()
        white_king, black_king = rng.sample(chess.SQUARES, 2)
        if chess.square_distance(white_king, black_king) < 2:
            continue
        board.set_piece_at(white_king, chess.Piece(chess.KING, chess.WHITE))
        board.set_piece_at(black_king, chess.Piece(chess.KING, chess.BLACK))
        extras = sorted(rng.sample(pool, pieces - 2), key=lambda item: item[1] != chess.PAWN)
        free = [square for square in chess.SQUARES if square not in (white_king, black_king)]
        rng.shuffle(free)
        for color, piece_type in extras:
            square = next(
                square for square in free if piece_type != chess.PAWN or 1 <= chess.square_rank(square) <= 6
            )
            free.remove(square)
            board.set_piece_at(square, chess.Piece(piece_type, color))
        board.turn = rng.choice(chess.COLORS)
        if _playable(board):
            return board
    msg = "could not generate a legal position"  # pragma: no cover - practically unreachable
    raise RuntimeError(msg)


def simulated_position(rng: random.Random, pieces: int) -> chess.Board | None:
    """Play a natural game (trading when above target) until exactly ``pieces`` remain."""
    for _ in range(SIMULATION_ATTEMPTS):
        board = chess.Board()
        prev_capture = False
        for _ in range(SIMULATION_MAX_PLIES):
            count = chess.popcount(board.occupied)
            if count < pieces:
                break
            if (
                count == pieces
                and len(board.move_stack) >= SIMULATION_MIN_PLIES
                and rng.random() < STOP_PROBABILITY
            ):
                return board
            bias = TRADE_BIAS if count > pieces else 0.0
            move = choose_move(board, rng, prev_capture=prev_capture, capture_bias=bias)
            if move is None:
                break
            prev_capture = board.is_capture(move)
            board.push(move)
    return None


def drill_position(rng: random.Random, pieces: int, puzzles: SolverPositions | None = None) -> DrillPosition:
    """Prefer a puzzle's solver position, then a simulated game, then a random position."""
    if not MIN_PIECES <= pieces <= MAX_PIECES:
        msg = f"pieces must be between {MIN_PIECES} and {MAX_PIECES}"
        raise ValueError(msg)
    candidates = []
    if puzzles is not None:
        candidates = sorted(puzzles.with_pieces(pieces), key=lambda puzzle: puzzle.id)
    if candidates:
        return DrillPosition(board=rng.choice(candidates).solver_board(), source="puzzle")
    simulated = simulated_position(rng, pieces)
    if simulated is not None:
        return DrillPosition(board=simulated, source="game")
    return DrillPosition(board=random_position(rng, pieces), source="random")
