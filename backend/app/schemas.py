"""Request and response models (the JSON contract with the frontend)."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.services.accuracy import Classification
from app.services.puzzles import Goal

UciMove = Annotated[
    str,
    StringConstraints(strip_whitespace=True, pattern=r"^[a-hA-H][1-8][a-hA-H][1-8][qrbnQRBN]?$"),
]


class ErrorResponse(BaseModel):
    detail: str


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    engine: bool = Field(description="Whether a Stockfish binary is usable for /api/analysis")
    puzzles: int = Field(description="Number of puzzles served")


class Puzzle(BaseModel):
    id: str
    fen: str = Field(description="Position before the opponent's setup move moves[0]")
    moves: list[str] = Field(description="UCI moves: setup move, then solver/reply alternating")
    rating: int
    themes: list[str]
    pieces: int = Field(description="Pieces in the solver's position (after moves[0])")
    goal: Goal


class PuzzleList(BaseModel):
    total: int
    items: list[Puzzle]


class Span(BaseModel):
    min: int | None
    max: int | None


class PuzzleMeta(BaseModel):
    count: int
    goals: dict[str, int]
    themes: dict[str, int] = Field(description="Theme counts, most frequent first")
    rating: Span
    pieces: Span


class SequenceDrill(BaseModel):
    seed: int
    plies: int
    san: list[str]
    uci: list[str]
    fen: str = Field(description="Position after the last ply")


class KnightRouteDrill(BaseModel):
    model_config = ConfigDict(validate_by_name=True, validate_by_alias=True)

    seed: int
    from_: str = Field(alias="from")
    to: str
    distance: int
    path: list[str] = Field(description="One shortest route, both end squares included")
    shortest_paths: int = Field(description="How many different shortest routes exist")


class PositionDrill(BaseModel):
    seed: int
    fen: str
    pieces: int
    description: str


class AnalysisRequest(BaseModel):
    moves: list[UciMove] = Field(default_factory=list, max_length=300)
    initial_fen: str | None = Field(default=None, max_length=120)
    depth: int = Field(default=12, ge=6, le=18)


class Evaluation(BaseModel):
    cp: int | None = Field(description="Centipawns from White's point of view")
    mate: int | None = Field(description="Moves to mate, > 0 White mates, < 0 Black mates, 0 = mated")
    win: float = Field(description="White's winning chances, 0-100")
    best_uci: str | None
    best_san: str | None


class PlyAnalysis(BaseModel):
    ply: int
    color: Literal["w", "b"]
    san: str
    uci: str
    cp: int | None
    mate: int | None
    win: float
    best_uci: str | None = Field(description="Engine's best move in the position before this ply")
    best_san: str | None
    drop: float
    accuracy: float
    classification: Classification


class SideAccuracy(BaseModel):
    white: float | None
    black: float | None


class ClassificationCounts(BaseModel):
    best: int
    excellent: int
    good: int
    inaccuracy: int
    mistake: int
    blunder: int


class SideCounts(BaseModel):
    white: ClassificationCounts
    black: ClassificationCounts


class AnalysisResponse(BaseModel):
    engine: str
    depth: int
    initial: Evaluation
    plies: list[PlyAnalysis]
    accuracy: SideAccuracy
    counts: SideCounts
