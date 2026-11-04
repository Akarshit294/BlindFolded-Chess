"""Shared helpers for the puzzle data pipeline.

Used by ``build_puzzles.py`` (Lichess import) and ``generate_puzzles.py`` (offline
fallback generator). The JSON written by :func:`write_puzzle_file` is the contract
shared with the API (``app/services/puzzles.py``) and the frontend bundle::

    {
        "version": 1,
        "source": "...",
        "generated": "YYYY-MM-DD",
        "count": N,
        "puzzles": [
            {
                "id": "00sHx",
                "fen": "...",
                "moves": ["e8d7", "a2e6"],
                "rating": 1760,
                "themes": ["mateIn1", "endgame"],
                "pieces": 9,
                "goal": "mate1",
            }
        ],
    }

Lichess convention: ``fen`` is the position *before* the opponent's setup move
``moves[0]``; the solver plays ``moves[1]``, ``moves[3]``, ... and always makes the
last move. ``pieces`` counts the pieces in the solver's position (after ``moves[0]``).
"""

from __future__ import annotations

import hashlib
import heapq
import json
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Final, Literal

import chess

if TYPE_CHECKING:
    from _typeshed import SupportsRichComparison

FORMAT_VERSION: Final = 1
LICHESS_SOURCE: Final = "Lichess puzzle database (database.lichess.org), CC0"

Goal = Literal["mate1", "mate2", "mate3", "win"]
GOALS: Final[tuple[Goal, ...]] = ("mate1", "mate2", "mate3", "win")
MATE_THEMES: Final[Mapping[str, Goal]] = {"mateIn1": "mate1", "mateIn2": "mate2", "mateIn3": "mate3"}
MATE_GOAL_THEME: Final[Mapping[Goal, str]] = {goal: theme for theme, goal in MATE_THEMES.items()}
MATE_GOAL_BY_LENGTH: Final[Mapping[int, Goal]] = {1: "mate1", 2: "mate2", 3: "mate3"}
WIN_THEMES: Final = frozenset({"crushing", "advantage"})

# Themes that carry no training value for the UI (length/origin markers) or are
# redundant with ``goal``; dropped to keep the bundles small.
NOISY_THEMES: Final = frozenset(
    {"mate", "short", "long", "veryLong", "oneMove", "master", "superGM"},
)
NOISY_THEME_PREFIXES: Final = ("masterVs",)

PIECE_BUCKETS: Final = ((3, 6), (7, 9), (10, 12), (13, 16))
PIECE_BUCKET_LABELS: Final = ("3-6", "7-9", "10-12", "13-16")
# Inclusive upper bounds of the first rating buckets; anything above is the last bucket.
RATING_BUCKET_LIMITS: Final = (1000, 1400, 1800, 2200)
RATING_BUCKET_LABELS: Final = ("<=1000", "1001-1400", "1401-1800", "1801-2200", ">2200")

Cell = tuple[Goal, int, int]
"""A sampling stratum: (goal, piece bucket index, rating bucket index)."""


@dataclass(frozen=True, slots=True)
class PuzzleEntry:
    """One puzzle in the bundled JSON format."""

    id: str
    fen: str
    moves: tuple[str, ...]
    rating: int
    themes: tuple[str, ...]
    pieces: int
    goal: Goal

    def to_json(self) -> dict[str, object]:
        return {
            "id": self.id,
            "fen": self.fen,
            "moves": list(self.moves),
            "rating": self.rating,
            "themes": list(self.themes),
            "pieces": self.pieces,
            "goal": self.goal,
        }

    @property
    def cell(self) -> Cell:
        bucket = piece_bucket(self.pieces)
        if bucket is None:
            msg = f"puzzle {self.id} has {self.pieces} pieces, outside every bucket"
            raise ValueError(msg)
        return (self.goal, bucket, rating_bucket(self.rating))


@dataclass(frozen=True, slots=True)
class LineCheck:
    """Facts established by replaying a puzzle line with python-chess."""

    pieces: int
    """Pieces on the board in the solver's position (after the setup move)."""
    solver_moves: int
    checkmate: bool
    """Whether the final position is checkmate."""


def check_line(fen: str, moves: Sequence[str]) -> LineCheck | None:
    """Replay ``moves`` from ``fen``; return ``None`` unless the line is a legal puzzle.

    A legal puzzle line has an even number of moves (setup move + solver/reply
    pairs, the solver moving last) and every move is legal in turn.
    """
    if len(moves) < 2 or len(moves) % 2:
        return None
    try:
        board = chess.Board(fen)
    except ValueError:
        return None
    if not board.is_valid():
        return None
    pieces = 0
    for index, uci in enumerate(moves):
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            return None
        if not board.is_legal(move):
            return None
        board.push(move)
        if index == 0:
            pieces = chess.popcount(board.occupied)
    return LineCheck(pieces=pieces, solver_moves=len(moves) // 2, checkmate=board.is_checkmate())


def goal_for(themes: Iterable[str], line: LineCheck) -> Goal | None:
    """Derive the training goal from the Lichess themes and the verified line.

    Mate goals must agree with the board: a ``mateInN`` theme requires the line to
    end in checkmate after exactly N solver moves. Other puzzles qualify as ``win``
    when tagged ``crushing`` or ``advantage``.
    """
    theme_set = set(themes)
    tagged = [MATE_THEMES[theme] for theme in sorted(theme_set & MATE_THEMES.keys())]
    if line.checkmate:
        expected = MATE_GOAL_BY_LENGTH.get(line.solver_moves)
        if expected is None or any(goal != expected for goal in tagged):
            return None
        return expected
    if tagged:
        return None
    if theme_set & WIN_THEMES:
        return "win"
    return None


def clean_themes(themes: Iterable[str], goal: Goal) -> tuple[str, ...]:
    """Drop noisy themes; make sure mate puzzles carry their ``mateInN`` theme."""
    kept = {
        theme
        for theme in themes
        if theme and theme not in NOISY_THEMES and not theme.startswith(NOISY_THEME_PREFIXES)
    }
    mate_theme = MATE_GOAL_THEME.get(goal)
    if mate_theme is not None:
        kept -= set(MATE_THEMES)
        kept.add(mate_theme)
    return tuple(sorted(kept))


def piece_bucket(pieces: int) -> int | None:
    for index, (low, high) in enumerate(PIECE_BUCKETS):
        if low <= pieces <= high:
            return index
    return None


def rating_bucket(rating: int) -> int:
    for index, limit in enumerate(RATING_BUCKET_LIMITS):
        if rating <= limit:
            return index
    return len(RATING_BUCKET_LIMITS)


def sample_key(seed: int, puzzle_id: str) -> int:
    """Deterministic pseudo-random rank of a puzzle (independent of input order)."""
    digest = hashlib.blake2b(f"{seed}:{puzzle_id}".encode(), digest_size=8).digest()
    return int.from_bytes(digest, "big")


def allocate[K: SupportsRichComparison](capacities: Mapping[K, int], total: int) -> dict[K, int]:
    """Split ``total`` as evenly as possible over keys without exceeding capacities.

    Water-filling: every open key gets an equal share; keys that run out of items
    return their unused share to the others. Leftover single units go to keys in
    sorted order, so the result is deterministic.
    """
    quotas = dict.fromkeys(capacities, 0)
    remaining = min(max(total, 0), sum(max(capacity, 0) for capacity in capacities.values()))
    open_keys = sorted(key for key, capacity in capacities.items() if capacity > 0)
    while remaining > 0 and open_keys:
        share = remaining // len(open_keys)
        if share == 0:
            for key in open_keys[:remaining]:
                quotas[key] += 1
            break
        still_open = []
        for key in open_keys:
            give = min(share, capacities[key] - quotas[key])
            quotas[key] += give
            remaining -= give
            if quotas[key] < capacities[key]:
                still_open.append(key)
        open_keys = still_open
    return quotas


def balanced_quotas(capacities: Mapping[Cell, int], total: int) -> dict[Cell, int]:
    """Balance first across goals, then across (piece bucket, rating bucket) cells."""
    goal_capacity: Counter[str] = Counter()
    for cell, capacity in capacities.items():
        goal_capacity[cell[0]] += capacity
    goal_quota = allocate(dict(goal_capacity), total)
    quotas: dict[Cell, int] = {}
    for goal, quota in goal_quota.items():
        cells = {cell: capacity for cell, capacity in capacities.items() if cell[0] == goal}
        quotas.update(allocate(cells, quota))
    return quotas


def stratified_sample(entries: Iterable[PuzzleEntry], total: int, seed: int) -> list[PuzzleEntry]:
    """Pick ``total`` entries balanced over goal, piece and rating buckets.

    Within a stratum the entries with the lowest :func:`sample_key` win, so a
    smaller sample is always a subset of a larger one drawn with the same seed.
    """
    pools: dict[Cell, list[tuple[int, str, PuzzleEntry]]] = {}
    seen: set[str] = set()
    for entry in entries:
        if entry.id in seen:
            continue
        seen.add(entry.id)
        pools.setdefault(entry.cell, []).append((sample_key(seed, entry.id), entry.id, entry))
    quotas = balanced_quotas({cell: len(pool) for cell, pool in pools.items()}, total)
    chosen: list[PuzzleEntry] = []
    for cell, pool in pools.items():
        pool.sort(key=lambda item: (item[0], item[1]))
        chosen.extend(item[2] for item in pool[: quotas.get(cell, 0)])
    return sort_entries(chosen)


@dataclass(slots=True)
class StratifiedReservoir:
    """Streaming companion of :func:`stratified_sample` with bounded memory.

    Keeps the ``per_cell`` lowest-key entries of every stratum (a bottom-k sketch),
    and counts everything it was offered.
    """

    seed: int
    per_cell: int
    counts: Counter[Cell] = field(default_factory=Counter)
    _heaps: dict[Cell, list[tuple[int, str, PuzzleEntry]]] = field(default_factory=dict)

    def add(self, entry: PuzzleEntry) -> None:
        """Offer an entry (duplicate ids are dropped later by the sampler)."""
        cell = entry.cell
        self.counts[cell] += 1
        heap = self._heaps.setdefault(cell, [])
        # Max-heap on the key (negated) so the worst retained entry is on top.
        item = (-sample_key(self.seed, entry.id), entry.id, entry)
        if len(heap) < self.per_cell:
            heapq.heappush(heap, item)
        elif item[:2] > heap[0][:2]:
            heapq.heapreplace(heap, item)

    def entries(self) -> list[PuzzleEntry]:
        return [item[2] for heap in self._heaps.values() for item in heap]

    def sample(self, total: int) -> list[PuzzleEntry]:
        return stratified_sample(self.entries(), total, self.seed)


def sort_entries(entries: Iterable[PuzzleEntry]) -> list[PuzzleEntry]:
    """Canonical file order: easiest first, ties broken by id."""
    return sorted(entries, key=lambda entry: (entry.rating, entry.id))


def today() -> str:
    return datetime.now(UTC).date().isoformat()


def render_puzzle_file(entries: Iterable[PuzzleEntry], *, source: str, generated: str) -> str:
    ordered = sort_entries(entries)
    payload = {
        "version": FORMAT_VERSION,
        "source": source,
        "generated": generated,
        "count": len(ordered),
        "puzzles": [entry.to_json() for entry in ordered],
    }
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"


def write_puzzle_file(path: Path, entries: Iterable[PuzzleEntry], *, source: str, generated: str) -> int:
    """Write compact JSON (no indentation) and return the size in bytes."""
    text = render_puzzle_file(entries, source=source, generated=generated)
    data = text.encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return len(data)


def fit_sample(
    entries: Sequence[PuzzleEntry],
    total: int,
    seed: int,
    *,
    max_bytes: int,
    source: str,
    generated: str,
) -> list[PuzzleEntry]:
    """Largest balanced subset (at most ``total``) whose rendered file fits ``max_bytes``."""
    target = min(total, len(entries))
    while True:
        subset = stratified_sample(entries, target, seed)
        size = len(render_puzzle_file(subset, source=source, generated=generated).encode("utf-8"))
        if size <= max_bytes or target == 0:
            return subset
        # Shrink proportionally (with a 1% safety margin) and try again.
        target = min(target - 1, int(target * max_bytes / size * 0.99))


def summarize(entries: Sequence[PuzzleEntry]) -> str:
    """Human-readable distribution table for logs and NOTES."""
    goals = Counter(entry.goal for entry in entries)
    pieces = Counter(entry.cell[1] for entry in entries)
    ratings = Counter(entry.cell[2] for entry in entries)
    lines = [f"total: {len(entries)}"]
    lines.append("goal:   " + ", ".join(f"{goal}={goals[goal]}" for goal in GOALS))
    lines.append(
        "pieces: " + ", ".join(f"{label}={pieces[index]}" for index, label in enumerate(PIECE_BUCKET_LABELS)),
    )
    lines.append(
        "rating: "
        + ", ".join(f"{label}={ratings[index]}" for index, label in enumerate(RATING_BUCKET_LABELS)),
    )
    return "\n".join(lines)
