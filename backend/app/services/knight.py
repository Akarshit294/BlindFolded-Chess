"""Knight-route drill: breadth-first search over knight moves on an empty board."""

from __future__ import annotations

import random
from collections import deque
from dataclasses import dataclass
from functools import cache
from typing import Final

import chess

MIN_DISTANCE: Final = 1
MAX_DISTANCE: Final = 6
"""The longest knight distance on an 8x8 board (corner to opposite corner)."""


@dataclass(frozen=True, slots=True)
class KnightRoute:
    start: chess.Square
    target: chess.Square
    distance: int
    path: tuple[chess.Square, ...]
    shortest_paths: int


def knight_moves(square: chess.Square) -> list[chess.Square]:
    return list(chess.SquareSet(chess.BB_KNIGHT_ATTACKS[square]))


@cache
def distances_from(square: chess.Square) -> tuple[int, ...]:
    """BFS distance (in knight moves) from ``square`` to every square."""
    distance = [-1] * 64
    distance[square] = 0
    queue = deque([square])
    while queue:
        current = queue.popleft()
        for neighbour in knight_moves(current):
            if distance[neighbour] < 0:
                distance[neighbour] = distance[current] + 1
                queue.append(neighbour)
    return tuple(distance)


def knight_distance(start: chess.Square, target: chess.Square) -> int:
    return distances_from(start)[target]


@cache
def _path_counts(target: chess.Square) -> tuple[int, ...]:
    """Number of shortest knight paths from every square to ``target``."""
    distance = distances_from(target)
    counts = [0] * 64
    counts[target] = 1
    for square in sorted(range(64), key=lambda sq: distance[sq]):
        if square == target:
            continue
        counts[square] = sum(
            counts[neighbour]
            for neighbour in knight_moves(square)
            if distance[neighbour] == distance[square] - 1
        )
    return tuple(counts)


def count_shortest_paths(start: chess.Square, target: chess.Square) -> int:
    return _path_counts(target)[start]


def random_shortest_path(start: chess.Square, target: chess.Square, rng: random.Random) -> list[chess.Square]:
    """A shortest path drawn uniformly among all shortest paths."""
    distance = distances_from(target)
    counts = _path_counts(target)
    path = [start]
    current = start
    while current != target:
        steps = sorted(
            neighbour for neighbour in knight_moves(current) if distance[neighbour] == distance[current] - 1
        )
        current = rng.choices(steps, weights=[counts[step] for step in steps])[0]
        path.append(current)
    return path


@cache
def _pairs_by_distance() -> dict[int, tuple[tuple[chess.Square, chess.Square], ...]]:
    pairs: dict[int, list[tuple[chess.Square, chess.Square]]] = {}
    for start in chess.SQUARES:
        for target, distance in enumerate(distances_from(start)):
            if distance > 0:
                pairs.setdefault(distance, []).append((start, target))
    return {distance: tuple(items) for distance, items in sorted(pairs.items())}


def random_route(rng: random.Random, min_moves: int, max_moves: int) -> KnightRoute:
    """Pick a distance uniformly in ``[min_moves, max_moves]``, then a square pair
    uniformly among pairs at that distance, then a uniform shortest path."""
    if not MIN_DISTANCE <= min_moves <= max_moves <= MAX_DISTANCE:
        msg = f"need {MIN_DISTANCE} <= min_moves <= max_moves <= {MAX_DISTANCE}"
        raise ValueError(msg)
    pairs = _pairs_by_distance()
    distance = rng.choice([d for d in range(min_moves, max_moves + 1) if pairs.get(d)])
    start, target = rng.choice(pairs[distance])
    path = random_shortest_path(start, target, rng)
    return KnightRoute(
        start=start,
        target=target,
        distance=distance,
        path=tuple(path),
        shortest_paths=count_shortest_paths(start, target),
    )
