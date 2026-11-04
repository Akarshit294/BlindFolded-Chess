"""Pure-Python forced-mate search (engine-free fallback for the puzzle generator).

An AND/OR alpha-beta search over python-chess legal moves: the attacker needs one
move that mates (or leaves every defence losing), the defender needs one move
that escapes. Results are memoised per (position, moves left), and the attacker's
last move only considers checking moves. Fast enough for the sparse positions
the generator uses: mate in 1-2 instantly, mate in 3 within a node budget.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Final

import chess
import chess.polyglot

DEFAULT_NODE_LIMIT: Final = 1_000_000
_VALUES: Final = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}


class SearchLimitError(RuntimeError):
    """The node budget ran out before the search finished."""


@dataclass(slots=True)
class MateSearch:
    """Memoised mate search; reuse one instance for related queries."""

    node_limit: int = DEFAULT_NODE_LIMIT
    nodes: int = 0
    _attack: dict[tuple[int, int], bool] = field(default_factory=dict)
    _defend: dict[tuple[int, int], bool] = field(default_factory=dict)

    def mates_in(self, board: chess.Board, moves: int) -> bool:
        """Can the side to move force checkmate within ``moves`` of its own moves?"""
        if moves < 1:
            return False
        key = (chess.polyglot.zobrist_hash(board), moves)
        cached = self._attack.get(key)
        if cached is not None:
            return cached
        self._tick()
        result = any(self._move_mates(board, move, moves) for move in self._attacker_moves(board, moves))
        self._attack[key] = result
        return result

    def always_mated(self, board: chess.Board, moves: int) -> bool:
        """Is the side to move checkmated within ``moves`` attacker moves whatever it plays?"""
        if board.is_checkmate():
            return True
        if moves < 1 or board.is_insufficient_material():
            return False
        key = (chess.polyglot.zobrist_hash(board), moves)
        cached = self._defend.get(key)
        if cached is not None:
            return cached
        self._tick()
        defences = self._defender_moves(board)
        result = bool(defences)  # no legal move and no checkmate: stalemate
        for move in defences:
            board.push(move)
            try:
                escaped = not self.mates_in(board, moves)
            finally:
                board.pop()
            if escaped:
                result = False
                break
        self._defend[key] = result
        return result

    def shortest_mate(self, board: chess.Board, max_moves: int) -> int | None:
        """Smallest N <= ``max_moves`` such that the side to move mates in N."""
        return next((n for n in range(1, max_moves + 1) if self.mates_in(board, n)), None)

    def mating_moves(self, board: chess.Board, moves: int) -> list[chess.Move]:
        """Every move that forces mate within ``moves`` (sorted by UCI)."""
        return [
            move
            for move in sorted(board.legal_moves, key=lambda candidate: candidate.uci())
            if self._move_mates(board, move, moves)
        ]

    def best_defence(self, board: chess.Board, max_moves: int) -> chess.Move | None:
        """The defence that delays mate the longest (ties broken by UCI order)."""
        best: tuple[int, chess.Move] | None = None
        for move in sorted(board.legal_moves, key=lambda candidate: candidate.uci()):
            board.push(move)
            try:
                needed = self.shortest_mate(board, max_moves)
            finally:
                board.pop()
            if needed is None:
                return None  # this defence escapes: not a forced mate
            if best is None or needed > best[0]:
                best = (needed, move)
        return None if best is None else best[1]

    def _move_mates(self, board: chess.Board, move: chess.Move, moves: int) -> bool:
        board.push(move)
        try:
            return board.is_checkmate() or (moves > 1 and self.always_mated(board, moves - 1))
        finally:
            board.pop()

    def _attacker_moves(self, board: chess.Board, moves: int) -> list[chess.Move]:
        checks: list[chess.Move] = []
        others: list[chess.Move] = []
        for move in board.legal_moves:
            if board.gives_check(move):
                checks.append(move)
            elif moves > 1:
                others.append(move)
        # Captures of valuable pieces first among the quiet moves.
        others.sort(key=lambda move: -_capture_value(board, move))
        return checks + others

    def _defender_moves(self, board: chess.Board) -> list[chess.Move]:
        # Captures (likely refutations) first, then king moves, then the rest.
        def order(move: chess.Move) -> tuple[int, int]:
            king_move = board.piece_type_at(move.from_square) == chess.KING
            return (-_capture_value(board, move), 0 if king_move else 1)

        return sorted(board.legal_moves, key=order)

    def _tick(self) -> None:
        self.nodes += 1
        if self.nodes > self.node_limit:
            msg = f"node limit {self.node_limit} exceeded"
            raise SearchLimitError(msg)


def _capture_value(board: chess.Board, move: chess.Move) -> int:
    if board.is_en_passant(move):
        return 1
    victim = board.piece_type_at(move.to_square)
    return 0 if victim is None else _VALUES[victim]


def find_mate(board: chess.Board, max_moves: int, *, node_limit: int = DEFAULT_NODE_LIMIT) -> int | None:
    """Convenience wrapper: shortest forced mate for the side to move, if any."""
    return MateSearch(node_limit=node_limit).shortest_mate(board.copy(stack=False), max_moves)
