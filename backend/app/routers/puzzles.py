from typing import Annotated, Any, Final, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import Context, SeedQuery, validation_error
from app.schemas import ErrorResponse, Puzzle, PuzzleList, PuzzleMeta
from app.services.puzzles import Puzzle as PuzzleRecord
from app.services.puzzles import PuzzleFilter

router = APIRouter(prefix="/puzzles", tags=["puzzles"])

MAX_RATING: Final = 4000
NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: {"model": ErrorResponse, "description": "Nothing matches"},
}


def puzzle_filter(
    goal: Annotated[Literal["mate1", "mate2", "mate3", "win", "any"], Query()] = "any",
    min_rating: Annotated[int | None, Query(ge=0, le=MAX_RATING)] = None,
    max_rating: Annotated[int | None, Query(ge=0, le=MAX_RATING)] = None,
    min_pieces: Annotated[int | None, Query(ge=2, le=32)] = None,
    max_pieces: Annotated[int | None, Query(ge=2, le=32)] = None,
    theme: Annotated[
        str | None,
        Query(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9]+$", description="Case-insensitive"),
    ] = None,
) -> PuzzleFilter:
    if min_rating is not None and max_rating is not None and min_rating > max_rating:
        raise validation_error(("query", "min_rating"), "min_rating must not exceed max_rating", min_rating)
    if min_pieces is not None and max_pieces is not None and min_pieces > max_pieces:
        raise validation_error(("query", "min_pieces"), "min_pieces must not exceed max_pieces", min_pieces)
    return PuzzleFilter(
        goal=None if goal == "any" else goal,
        min_rating=min_rating,
        max_rating=max_rating,
        min_pieces=min_pieces,
        max_pieces=max_pieces,
        theme=theme,
    )


Filters = Annotated[PuzzleFilter, Depends(puzzle_filter)]


def _to_model(puzzle: PuzzleRecord) -> Puzzle:
    return Puzzle.model_validate(puzzle.to_dict())


@router.get("", response_model=PuzzleList, summary="List puzzles")
def list_puzzles(
    context: Context,
    filters: Filters,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=1_000_000)] = 0,
    seed: SeedQuery = None,
) -> PuzzleList:
    """Matching puzzles in file order (easiest first), or in a seeded shuffle when
    ``seed`` is given (stable across pages for the same seed)."""
    total, items = context.puzzles.page(filters, limit=limit, offset=offset, seed=seed)
    return PuzzleList(total=total, items=[_to_model(puzzle) for puzzle in items])


@router.get("/random", response_model=Puzzle, responses=NOT_FOUND, summary="One random puzzle")
def random_puzzle(
    context: Context,
    filters: Filters,
    seed: SeedQuery = None,
    exclude: Annotated[
        str | None,
        Query(max_length=20_000, description="Comma-separated puzzle ids to skip"),
    ] = None,
) -> Puzzle:
    excluded = {part.strip() for part in exclude.split(",") if part.strip()} if exclude else set()
    puzzle = context.puzzles.pick(filters, exclude=excluded, seed=seed)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="no puzzle matches the filters")
    return _to_model(puzzle)


@router.get("/meta", response_model=PuzzleMeta, summary="Counts and ranges of the puzzle set")
def puzzle_meta(context: Context) -> PuzzleMeta:
    return PuzzleMeta.model_validate(context.puzzles.meta())


@router.get("/{puzzle_id}", response_model=Puzzle, responses=NOT_FOUND, summary="One puzzle by id")
def get_puzzle(context: Context, puzzle_id: str) -> Puzzle:
    puzzle = context.puzzles.get(puzzle_id)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="puzzle not found")
    return _to_model(puzzle)
