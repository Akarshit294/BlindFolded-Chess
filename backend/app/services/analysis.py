"""Game analysis with a UCI engine: evaluations, win%, accuracy and classifications."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import chess
import chess.engine

from app.services.accuracy import (
    CLASSIFICATIONS,
    Classification,
    classify,
    move_accuracy,
    round1,
    side_accuracy,
    win_drop,
    win_percent,
)

MAX_PLIES = 300
MIN_DEPTH = 6
MAX_DEPTH = 18


class IllegalMoveError(ValueError):
    """A submitted move is malformed or illegal; ``index`` is 0-based."""

    def __init__(self, index: int, uci: str, reason: str) -> None:
        super().__init__(f"move {index + 1} ({uci!r}): {reason}")
        self.index = index
        self.uci = uci
        self.reason = reason


class InvalidPositionError(ValueError):
    """The initial FEN cannot be parsed or is not a legal position."""


def parse_game(moves: Sequence[str], initial_fen: str | None) -> tuple[chess.Board, list[chess.Move]]:
    """Validate the starting position and every move; returns the root board and moves."""
    try:
        root = chess.Board(initial_fen) if initial_fen else chess.Board()
    except ValueError as exc:
        raise InvalidPositionError(str(exc)) from exc
    if not root.is_valid():
        msg = f"illegal position ({root.status()!r})"
        raise InvalidPositionError(msg)
    board = root.copy()
    parsed: list[chess.Move] = []
    for index, uci in enumerate(moves):
        try:
            move = board.parse_uci(uci.strip().lower())
        except chess.InvalidMoveError as exc:
            raise IllegalMoveError(index, uci, "not a UCI move") from exc
        except (chess.IllegalMoveError, chess.AmbiguousMoveError) as exc:
            raise IllegalMoveError(index, uci, "illegal in this position") from exc
        parsed.append(move)
        board.push(move)
    return root, parsed


@dataclass(frozen=True, slots=True)
class Evaluation:
    """Evaluation of a position from White's point of view."""

    cp: int | None
    mate: int | None
    win: float
    best: chess.Move | None


def evaluate(
    engine: chess.engine.SimpleEngine,
    board: chess.Board,
    *,
    depth: int,
    max_time: float | None,
    game: object,
) -> Evaluation:
    """Evaluate ``board`` (with its move stack, so repetitions are seen).

    Finished games are scored without the engine: checkmate is a mate in 0
    (win 100/0), stalemate and other automatic draws are 0 cp.
    """
    outcome = board.outcome(claim_draw=False)
    if outcome is not None and outcome.termination == chess.Termination.CHECKMATE:
        white_to_move = board.turn == chess.WHITE
        return Evaluation(cp=None, mate=0, win=win_percent(None, 0, white_to_move=white_to_move), best=None)
    if outcome is not None and not any(board.generate_legal_moves()):
        return Evaluation(cp=0, mate=None, win=win_percent(0, None, white_to_move=True), best=None)
    limit = chess.engine.Limit(depth=depth, time=max_time or None)
    info = engine.analyse(board, limit, game=game)
    pv = info.get("pv") or []
    best = pv[0] if pv and board.is_legal(pv[0]) else None
    if outcome is not None:
        # Draw by rule (insufficient material, 75 moves, fivefold) with moves left.
        return Evaluation(cp=0, mate=None, win=win_percent(0, None, white_to_move=True), best=best)
    score = info.get("score")
    if score is None:
        msg = "engine returned no score"
        raise chess.engine.EngineError(msg)
    white = score.white()
    mate = white.mate()
    cp = None if mate is not None else white.score()
    if mate is None and cp is None:
        msg = "engine returned an empty score"
        raise chess.engine.EngineError(msg)
    win = win_percent(cp, mate, white_to_move=board.turn == chess.WHITE)
    return Evaluation(cp=cp, mate=mate, win=win, best=best)


def _best_fields(board: chess.Board, evaluation: Evaluation) -> dict[str, Any]:
    best = evaluation.best
    return {
        "best_uci": best.uci() if best else None,
        "best_san": board.san(best) if best else None,
    }


def analyse_game(
    engine: chess.engine.SimpleEngine,
    engine_name: str,
    root: chess.Board,
    moves: Sequence[chess.Move],
    *,
    depth: int,
    max_time: float | None,
) -> dict[str, Any]:
    """Analyse a validated game; returns the ``POST /api/analysis`` response body."""
    game = object()  # one hash/history context per request
    board = root.copy()
    current = evaluate(engine, board, depth=depth, max_time=max_time, game=game)
    initial = {
        "cp": current.cp,
        "mate": current.mate,
        "win": round1(current.win),
        **_best_fields(board, current),
    }

    plies: list[dict[str, Any]] = []
    accuracies: dict[str, list[float]] = {"white": [], "black": []}
    counts: dict[str, dict[Classification, int]] = {
        side: dict.fromkeys(CLASSIFICATIONS, 0) for side in ("white", "black")
    }
    for ply, move in enumerate(moves, start=1):
        white_moved = board.turn == chess.WHITE
        side = "white" if white_moved else "black"
        san = board.san(move)
        best_fields = _best_fields(board, current)
        is_best = current.best is not None and move == current.best
        before = current
        board.push(move)
        current = evaluate(engine, board, depth=depth, max_time=max_time, game=game)
        drop = win_drop(before.win, current.win, white_moved=white_moved)
        accuracy = move_accuracy(drop)
        classification = classify(drop, is_best=is_best)
        accuracies[side].append(accuracy)
        counts[side][classification] += 1
        plies.append(
            {
                "ply": ply,
                "color": "w" if white_moved else "b",
                "san": san,
                "uci": move.uci(),
                "cp": current.cp,
                "mate": current.mate,
                "win": round1(current.win),
                **best_fields,
                "drop": round1(drop),
                "accuracy": round1(accuracy),
                "classification": classification,
            },
        )

    def side_value(side: str) -> float | None:
        value = side_accuracy(accuracies[side])
        return None if value is None else round1(value)

    return {
        "engine": engine_name,
        "depth": depth,
        "initial": initial,
        "plies": plies,
        "accuracy": {"white": side_value("white"), "black": side_value("black")},
        "counts": counts,
    }
