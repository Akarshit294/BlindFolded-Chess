import random

import chess
import pytest

from app.services.knight import (
    count_shortest_paths,
    distances_from,
    knight_distance,
    random_route,
    random_shortest_path,
)


@pytest.mark.parametrize(
    ("start", "target", "distance"),
    [
        ("d4", "d4", 0),
        ("b1", "c3", 1),
        ("d4", "e5", 2),
        ("d4", "d5", 3),
        ("a1", "b2", 4),  # the corner makes the diagonal neighbour expensive
        ("a1", "h8", 6),
        ("h1", "a8", 6),
    ],
)
def test_known_distances(start: str, target: str, distance: int) -> None:
    assert knight_distance(chess.parse_square(start), chess.parse_square(target)) == distance


def test_distances_are_symmetric_and_bounded() -> None:
    for start in chess.SQUARES:
        row = distances_from(start)
        assert min(row) == 0
        assert max(row) <= 6
        for target in chess.SQUARES:
            assert row[target] == distances_from(target)[start]


def test_only_opposite_corners_are_six_moves_apart() -> None:
    pairs = {
        (chess.square_name(a), chess.square_name(b))
        for a in chess.SQUARES
        for b in chess.SQUARES
        if knight_distance(a, b) == 6
    }
    assert pairs == {("a1", "h8"), ("h8", "a1"), ("h1", "a8"), ("a8", "h1")}


def test_shortest_path_counts() -> None:
    assert count_shortest_paths(chess.B1, chess.C3) == 1
    assert count_shortest_paths(chess.D4, chess.E5) == 2  # via f3 or c6
    assert count_shortest_paths(chess.D4, chess.D4) == 1


def test_random_shortest_path_is_valid_and_uniformish() -> None:
    rng = random.Random(0)
    seen = set()
    for _ in range(200):
        path = random_shortest_path(chess.D4, chess.E5, rng)
        assert len(path) == 3
        seen.add(tuple(path))
    assert seen == {(chess.D4, chess.F3, chess.E5), (chess.D4, chess.C6, chess.E5)}


@pytest.mark.parametrize("seed", range(40))
def test_random_route_respects_bounds(seed: int) -> None:
    rng = random.Random(seed)
    low = 1 + seed % 6
    high = low + (seed // 6) % (7 - low)
    route = random_route(rng, low, high)
    assert low <= route.distance <= high
    assert route.path[0] == route.start
    assert route.path[-1] == route.target
    assert len(route.path) == route.distance + 1
    for a, b in zip(route.path, route.path[1:], strict=False):
        assert b in chess.SquareSet(chess.BB_KNIGHT_ATTACKS[a])
    assert route.shortest_paths == count_shortest_paths(route.start, route.target) >= 1


def test_random_route_is_deterministic() -> None:
    assert random_route(random.Random(7), 2, 5) == random_route(random.Random(7), 2, 5)


@pytest.mark.parametrize(("low", "high"), [(0, 3), (3, 2), (2, 7)])
def test_random_route_rejects_bad_bounds(low: int, high: int) -> None:
    with pytest.raises(ValueError, match="min_moves"):
        random_route(random.Random(1), low, high)
