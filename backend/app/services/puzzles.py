"""In-memory puzzle store loaded from the bundled JSON file."""

from __future__ import annotations

import json
import logging
import random
from collections import Counter
from collections.abc import Collection, Iterable, Iterator, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final, Literal, get_args

import chess

LOG = logging.getLogger(__name__)

Goal = Literal["mate1", "mate2", "mate3", "win"]
GOALS: Final[tuple[Goal, ...]] = get_args(Goal)


class PuzzleFileError(ValueError):
    """The puzzle file is malformed."""


@dataclass(frozen=True, slots=True)
class Puzzle:
    id: str
    fen: str
    moves: tuple[str, ...]
    rating: int
    themes: tuple[str, ...]
    pieces: int
    goal: Goal
    theme_keys: frozenset[str] = field(default=frozenset(), compare=False, repr=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "fen": self.fen,
            "moves": list(self.moves),
            "rating": self.rating,
            "themes": list(self.themes),
            "pieces": self.pieces,
            "goal": self.goal,
        }

    def solver_board(self) -> chess.Board:
        """The position the solver sees (after the opponent's setup move)."""
        board = chess.Board(self.fen)
        board.push_uci(self.moves[0])
        return board

    @classmethod
    def from_json(cls, raw: object) -> Puzzle:
        if not isinstance(raw, dict):
            msg = "puzzle entries must be objects"
            raise PuzzleFileError(msg)
        try:
            goal = raw["goal"]
            if goal not in GOALS:
                msg = f"unknown goal {goal!r}"
                raise PuzzleFileError(msg)
            if not isinstance(raw["moves"], list) or not isinstance(raw["themes"], list):
                msg = "moves and themes must be lists"
                raise PuzzleFileError(msg)
            moves = tuple(str(move) for move in raw["moves"])
            themes = tuple(str(theme) for theme in raw["themes"])
            puzzle = cls(
                id=str(raw["id"]),
                fen=str(raw["fen"]),
                moves=moves,
                rating=int(raw["rating"]),
                themes=themes,
                pieces=int(raw["pieces"]),
                goal=goal,
                theme_keys=frozenset(theme.lower() for theme in themes),
            )
        except (KeyError, TypeError, ValueError) as exc:
            msg = f"invalid puzzle entry {raw.get('id')!r}: {exc}"
            raise PuzzleFileError(msg) from exc
        if len(puzzle.moves) < 2:
            msg = f"puzzle {puzzle.id} has no solution"
            raise PuzzleFileError(msg)
        return puzzle


@dataclass(frozen=True, slots=True)
class PuzzleFilter:
    goal: Goal | None = None
    min_rating: int | None = None
    max_rating: int | None = None
    min_pieces: int | None = None
    max_pieces: int | None = None
    theme: str | None = None

    def matches(self, puzzle: Puzzle) -> bool:
        return (
            (self.goal is None or puzzle.goal == self.goal)
            and (self.min_rating is None or puzzle.rating >= self.min_rating)
            and (self.max_rating is None or puzzle.rating <= self.max_rating)
            and (self.min_pieces is None or puzzle.pieces >= self.min_pieces)
            and (self.max_pieces is None or puzzle.pieces <= self.max_pieces)
            and (self.theme is None or self.theme.lower() in puzzle.theme_keys)
        )


class PuzzleStore:
    def __init__(self, puzzles: Iterable[Puzzle], *, source: str = "", generated: str = "") -> None:
        unique: dict[str, Puzzle] = {}
        for puzzle in puzzles:
            unique.setdefault(puzzle.id, puzzle)
        self._puzzles: tuple[Puzzle, ...] = tuple(unique.values())
        self._by_id = unique
        by_pieces: dict[int, list[Puzzle]] = {}
        for puzzle in self._puzzles:
            by_pieces.setdefault(puzzle.pieces, []).append(puzzle)
        self._by_pieces = {count: tuple(items) for count, items in by_pieces.items()}
        self.source = source
        self.generated = generated
        self._meta = self._compute_meta()

    @classmethod
    def load(cls, path: Path) -> PuzzleStore:
        """Load a puzzle file; a missing file yields an empty store (logged)."""
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            LOG.warning("puzzle file %s not found; serving no puzzles", path)
            return cls([])
        except json.JSONDecodeError as exc:
            msg = f"{path}: invalid JSON ({exc})"
            raise PuzzleFileError(msg) from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("puzzles"), list):
            msg = f"{path}: expected an object with a 'puzzles' list"
            raise PuzzleFileError(msg)
        puzzles = [Puzzle.from_json(item) for item in payload["puzzles"]]
        return cls(
            puzzles,
            source=str(payload.get("source", "")),
            generated=str(payload.get("generated", "")),
        )

    def __len__(self) -> int:
        return len(self._puzzles)

    def __iter__(self) -> Iterator[Puzzle]:
        return iter(self._puzzles)

    def get(self, puzzle_id: str) -> Puzzle | None:
        return self._by_id.get(puzzle_id)

    def filter(self, criteria: PuzzleFilter) -> list[Puzzle]:
        return [puzzle for puzzle in self._puzzles if criteria.matches(puzzle)]

    def page(
        self,
        criteria: PuzzleFilter,
        *,
        limit: int,
        offset: int = 0,
        seed: int | None = None,
    ) -> tuple[int, list[Puzzle]]:
        """Filtered slice in file order, or in a seeded shuffle when ``seed`` is given."""
        matches = self.filter(criteria)
        if seed is not None:
            random.Random(seed).shuffle(matches)
        return len(matches), matches[offset : offset + limit]

    def pick(
        self,
        criteria: PuzzleFilter,
        *,
        exclude: Collection[str] = (),
        seed: int | None = None,
    ) -> Puzzle | None:
        """One random matching puzzle (deterministic for a given seed)."""
        candidates = [puzzle for puzzle in self.filter(criteria) if puzzle.id not in exclude]
        if not candidates:
            return None
        rng = random.Random(seed) if seed is not None else random.SystemRandom()
        return rng.choice(candidates)

    def with_pieces(self, pieces: int) -> Sequence[Puzzle]:
        return self._by_pieces.get(pieces, ())

    def meta(self) -> dict[str, Any]:
        return self._meta

    def _compute_meta(self) -> dict[str, Any]:
        goals = Counter(puzzle.goal for puzzle in self._puzzles)
        themes = Counter(theme for puzzle in self._puzzles for theme in puzzle.themes)
        ratings = [puzzle.rating for puzzle in self._puzzles]
        pieces = [puzzle.pieces for puzzle in self._puzzles]
        return {
            "count": len(self._puzzles),
            "goals": {goal: goals[goal] for goal in GOALS},
            "themes": dict(sorted(themes.items(), key=lambda item: (-item[1], item[0]))),
            "rating": {"min": min(ratings, default=None), "max": max(ratings, default=None)},
            "pieces": {"min": min(pieces, default=None), "max": max(pieces, default=None)},
        }
