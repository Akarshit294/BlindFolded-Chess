from typing import Any, Final

from fastapi import APIRouter

from app.deps import Context, validation_error
from app.schemas import AnalysisRequest, AnalysisResponse, ErrorResponse
from app.services.analysis import IllegalMoveError, InvalidPositionError, analyse_game, parse_game

router = APIRouter(tags=["analysis"])

RESPONSES: Final[dict[int | str, dict[str, Any]]] = {
    503: {"model": ErrorResponse, "description": "No engine available; analyse in the browser instead"},
}


@router.post("/analysis", response_model=AnalysisResponse, responses=RESPONSES, summary="Analyse a game")
def analyse(context: Context, body: AnalysisRequest) -> dict[str, Any]:
    """Evaluate every position with Stockfish. Evaluations (``cp``/``mate``/``win``)
    are from White's point of view after each ply; ``best_*`` is the engine's
    choice in the position before the ply."""
    try:
        root, moves = parse_game(body.moves, body.initial_fen)
    except InvalidPositionError as exc:
        raise validation_error(("body", "initial_fen"), f"invalid position: {exc}", body.initial_fen) from exc
    except IllegalMoveError as exc:
        raise validation_error(("body", "moves", exc.index), str(exc), exc.uci) from exc
    max_time = context.settings.engine_max_time or None
    with context.engine.acquire() as engine:
        return analyse_game(engine, context.engine.name, root, moves, depth=body.depth, max_time=max_time)
