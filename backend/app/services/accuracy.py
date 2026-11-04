"""Evaluation -> win% -> accuracy formulas.

These are a contract with the frontend's in-browser analysis and must stay
identical (same constants, same order of operations). All functions work on
unrounded floats; rounding to one decimal happens only when serialising.

* ``win(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)``, cp clamped to
  [-1000, 1000]; a mate for White is 100, a mate for Black is 0 (mate in 0 means
  the side to move is mated).
* per move, from the mover's point of view:
  ``drop = max(0, win_before - win_after)`` where the mover's win is ``win`` for
  White and ``100 - win`` for Black.
* ``accuracy = clamp(103.1668100711649 * exp(-0.04354415386753951 * drop)
  - 3.166924740191411, 0, 100)``
* classification: drop >= 15 blunder, >= 10 mistake, >= 5 inaccuracy, else
  "best" if the move is the engine's best move, else "excellent" if drop < 2,
  else "good".
* side accuracy: ``(arithmetic mean + harmonic mean) / 2`` of the side's move
  accuracies, the harmonic mean using ``max(accuracy, 1)``; ``None`` without moves.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Final, Literal

Classification = Literal["best", "excellent", "good", "inaccuracy", "mistake", "blunder"]
CLASSIFICATIONS: Final[tuple[Classification, ...]] = (
    "best",
    "excellent",
    "good",
    "inaccuracy",
    "mistake",
    "blunder",
)

CP_CLAMP: Final = 1000.0
WIN_SLOPE: Final = 0.00368208
ACCURACY_SCALE: Final = 103.1668100711649
ACCURACY_DECAY: Final = 0.04354415386753951
ACCURACY_OFFSET: Final = 3.166924740191411

BLUNDER_DROP: Final = 15.0
MISTAKE_DROP: Final = 10.0
INACCURACY_DROP: Final = 5.0
EXCELLENT_DROP: Final = 2.0


def win_from_cp(cp: float) -> float:
    """White's winning chances (0-100) for a centipawn score from White's view."""
    clamped = max(-CP_CLAMP, min(CP_CLAMP, cp))
    return 50.0 + 50.0 * (2.0 / (1.0 + math.exp(-WIN_SLOPE * clamped)) - 1.0)


def win_percent(cp: float | None, mate: int | None, *, white_to_move: bool) -> float:
    """White's winning chances for an evaluation from White's point of view.

    ``mate > 0``: White mates; ``mate < 0``: Black mates; ``mate == 0``: the side
    to move is already checkmated.
    """
    if mate is not None:
        if mate > 0:
            return 100.0
        if mate < 0:
            return 0.0
        return 0.0 if white_to_move else 100.0
    if cp is None:
        msg = "an evaluation needs either cp or mate"
        raise ValueError(msg)
    return win_from_cp(cp)


def mover_win(win_white: float, *, white_moved: bool) -> float:
    return win_white if white_moved else 100.0 - win_white


def win_drop(win_before: float, win_after: float, *, white_moved: bool) -> float:
    """How much the mover's winning chances fell (never negative)."""
    before = mover_win(win_before, white_moved=white_moved)
    after = mover_win(win_after, white_moved=white_moved)
    return max(0.0, before - after)


def move_accuracy(drop: float) -> float:
    raw = ACCURACY_SCALE * math.exp(-ACCURACY_DECAY * drop) - ACCURACY_OFFSET
    return max(0.0, min(100.0, raw))


def classify(drop: float, *, is_best: bool) -> Classification:
    if drop >= BLUNDER_DROP:
        return "blunder"
    if drop >= MISTAKE_DROP:
        return "mistake"
    if drop >= INACCURACY_DROP:
        return "inaccuracy"
    if is_best:
        return "best"
    if drop < EXCELLENT_DROP:
        return "excellent"
    return "good"


def side_accuracy(accuracies: Sequence[float]) -> float | None:
    """Blend of arithmetic and harmonic means; ``None`` when the side has no moves."""
    if not accuracies:
        return None
    count = len(accuracies)
    arithmetic = sum(accuracies) / count
    harmonic = count / sum(1.0 / max(value, 1.0) for value in accuracies)
    return (arithmetic + harmonic) / 2.0


def round1(value: float) -> float:
    """Serialisation rounding (one decimal)."""
    return round(value, 1)
