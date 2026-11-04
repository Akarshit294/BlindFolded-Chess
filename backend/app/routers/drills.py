import random
from typing import Annotated

import chess
from fastapi import APIRouter, Query

from app.deps import Context, SeedQuery, resolve_seed, validation_error
from app.schemas import KnightRouteDrill, PositionDrill, SequenceDrill
from app.services.knight import MAX_DISTANCE, MIN_DISTANCE, random_route
from app.services.positions import MAX_PIECES, MIN_PIECES, describe, drill_position
from app.services.sequence import generate_game

router = APIRouter(prefix="/drills", tags=["drills"])


@router.get("/sequence", response_model=SequenceDrill, summary="Natural-looking game from the start")
def sequence_drill(
    plies: Annotated[int, Query(ge=2, le=40)] = 10,
    seed: SeedQuery = None,
) -> SequenceDrill:
    """An engine-free, natural-looking game of exactly ``plies`` half-moves
    (never cut short by mate). Deterministic for a given seed."""
    resolved = resolve_seed(seed)
    game = generate_game(plies, resolved)
    return SequenceDrill(
        seed=resolved,
        plies=plies,
        san=list(game.san),
        uci=[move.uci() for move in game.moves],
        fen=game.board.fen(),
    )


@router.get("/knight-route", response_model=KnightRouteDrill, summary="Knight route between two squares")
def knight_route_drill(
    seed: SeedQuery = None,
    min_moves: Annotated[int, Query(ge=MIN_DISTANCE, le=MAX_DISTANCE)] = 2,
    max_moves: Annotated[int, Query(ge=MIN_DISTANCE, le=MAX_DISTANCE)] = 5,
) -> KnightRouteDrill:
    """Two squares whose knight distance lies in ``[min_moves, max_moves]`` (distance
    chosen uniformly first), with one uniformly drawn shortest route."""
    if min_moves > max_moves:
        raise validation_error(("query", "min_moves"), "min_moves must not exceed max_moves", min_moves)
    resolved = resolve_seed(seed)
    route = random_route(random.Random(resolved), min_moves, max_moves)
    return KnightRouteDrill(
        seed=resolved,
        from_=chess.square_name(route.start),
        to=chess.square_name(route.target),
        distance=route.distance,
        path=[chess.square_name(square) for square in route.path],
        shortest_paths=route.shortest_paths,
    )


@router.get("/position", response_model=PositionDrill, summary="Position to visualise, with description")
def position_drill(
    context: Context,
    pieces: Annotated[int, Query(ge=MIN_PIECES, le=MAX_PIECES)] = 6,
    seed: SeedQuery = None,
) -> PositionDrill:
    """A puzzle position with exactly ``pieces`` pieces when available, else a
    position from a simulated natural game, else a random legal position."""
    resolved = resolve_seed(seed)
    position = drill_position(random.Random(resolved), pieces, context.puzzles)
    return PositionDrill(
        seed=resolved,
        fen=position.board.fen(),
        pieces=chess.popcount(position.board.occupied),
        description=describe(position.board),
    )
