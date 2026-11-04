import math

import pytest

from app.services.accuracy import (
    CLASSIFICATIONS,
    classify,
    move_accuracy,
    round1,
    side_accuracy,
    win_drop,
    win_from_cp,
    win_percent,
)


def reference_win(cp: float) -> float:
    cp = max(-1000.0, min(1000.0, cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def reference_accuracy(drop: float) -> float:
    raw = 103.1668100711649 * math.exp(-0.04354415386753951 * drop) - 3.166924740191411
    return max(0.0, min(100.0, raw))


@pytest.mark.parametrize("cp", [-5000, -1000, -250, -1, 0, 1, 37, 100, 300, 999, 1000, 4000])
def test_win_matches_reference_formula(cp: int) -> None:
    assert win_from_cp(cp) == pytest.approx(reference_win(cp), abs=1e-12)


def test_win_known_values_and_symmetry() -> None:
    assert win_from_cp(0) == 50.0
    assert win_from_cp(100) == pytest.approx(59.10, abs=0.01)
    assert win_from_cp(-100) == pytest.approx(40.90, abs=0.01)
    assert win_from_cp(2500) == win_from_cp(1000)  # clamped
    assert win_from_cp(-2500) == win_from_cp(-1000)
    for cp in (13, 250, 777):
        assert win_from_cp(cp) + win_from_cp(-cp) == pytest.approx(100.0)


def test_mate_scores() -> None:
    assert win_percent(None, 3, white_to_move=True) == 100.0
    assert win_percent(None, 1, white_to_move=False) == 100.0
    assert win_percent(None, -2, white_to_move=True) == 0.0
    # Mate in 0: the side to move is checkmated.
    assert win_percent(None, 0, white_to_move=True) == 0.0
    assert win_percent(None, 0, white_to_move=False) == 100.0
    assert win_percent(35, None, white_to_move=False) == win_from_cp(35)
    with pytest.raises(ValueError, match="cp or mate"):
        win_percent(None, None, white_to_move=True)


def test_drop_is_from_the_movers_point_of_view() -> None:
    assert win_drop(60.0, 50.0, white_moved=True) == 10.0
    assert win_drop(50.0, 60.0, white_moved=True) == 0.0  # improvements never count
    assert win_drop(50.0, 60.0, white_moved=False) == pytest.approx(10.0)
    assert win_drop(60.0, 50.0, white_moved=False) == 0.0


@pytest.mark.parametrize("drop", [0, 0.5, 2, 5, 9.99, 10, 15, 30, 70, 100])
def test_accuracy_matches_reference_formula(drop: float) -> None:
    assert move_accuracy(drop) == pytest.approx(reference_accuracy(drop), abs=1e-12)


def test_accuracy_bounds() -> None:
    assert round1(move_accuracy(0)) == 100.0
    assert move_accuracy(10) == pytest.approx(63.58, abs=0.01)
    assert move_accuracy(100) == 0.0  # clamped at zero
    assert all(0 <= move_accuracy(drop / 4) <= 100 for drop in range(401))


@pytest.mark.parametrize(
    ("drop", "is_best", "expected"),
    [
        (0.0, True, "best"),
        (4.99, True, "best"),
        (0.0, False, "excellent"),
        (1.99, False, "excellent"),
        (2.0, False, "good"),
        (4.99, False, "good"),
        (5.0, True, "inaccuracy"),
        (9.99, False, "inaccuracy"),
        (10.0, False, "mistake"),
        (14.99, True, "mistake"),
        (15.0, False, "blunder"),
        (80.0, True, "blunder"),
    ],
)
def test_classification_thresholds(drop: float, is_best: bool, expected: str) -> None:
    assert classify(drop, is_best=is_best) == expected
    assert expected in CLASSIFICATIONS


def test_side_accuracy_blends_arithmetic_and_harmonic_means() -> None:
    assert side_accuracy([]) is None
    assert side_accuracy([100.0, 100.0]) == pytest.approx(100.0)
    # arithmetic 50, harmonic 2 / (1/100 + 1/max(0, 1)) = 1.980...
    assert side_accuracy([100.0, 0.0]) == pytest.approx((50 + 2 / 1.01) / 2)
    values = [90.0, 75.5, 40.0, 99.9]
    arithmetic = sum(values) / len(values)
    harmonic = len(values) / sum(1 / v for v in values)
    assert side_accuracy(values) == pytest.approx((arithmetic + harmonic) / 2)
    assert round1(side_accuracy(values) or 0) == round((arithmetic + harmonic) / 2, 1)
