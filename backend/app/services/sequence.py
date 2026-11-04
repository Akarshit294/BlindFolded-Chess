"""Engine-free generator of natural-looking games for the move-sequence drill.

Every legal move gets a heuristic score (central pawns and development early,
castling, sensible captures and recaptures, not leaving pieces en prise, no
early king walks or queen sorties). A move is then sampled with probability
proportional to ``exp(score / TEMPERATURE)`` among the moves scoring within
``MARGIN`` of the best one. Moves that would end the game are never chosen.
Legal moves are sorted by UCI before sampling, so a seed always produces the
same game for a given library version.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Final

import chess

PIECE_VALUES: Final[dict[chess.PieceType, float]] = {
    chess.PAWN: 1.0,
    chess.KNIGHT: 3.0,
    chess.BISHOP: 3.25,
    chess.ROOK: 5.0,
    chess.QUEEN: 9.0,
    chess.KING: 0.0,
}
TEMPERATURE: Final = 0.8
MARGIN: Final = 3.5
OPENING_PLIES: Final = 20
MAX_ATTEMPTS: Final = 50

# (single step, double step) bonus for a pawn leaving its start square, by file a..h.
PAWN_START_BONUS: Final = (
    (-0.9, -1.0),
    (0.4, -0.3),
    (0.9, 1.4),
    (1.3, 2.6),
    (1.3, 2.6),
    (-0.6, -0.5),
    (0.4, -0.6),
    (-0.9, -1.0),
)
KNIGHT_SQUARES: Final = {
    chess.WHITE: frozenset({chess.C3, chess.F3}),
    chess.BLACK: frozenset({chess.C6, chess.F6}),
}


@dataclass(frozen=True, slots=True)
class GeneratedGame:
    seed: int
    moves: tuple[chess.Move, ...]
    san: tuple[str, ...]
    board: chess.Board


def _value_at(board: chess.Board, square: chess.Square) -> float:
    piece_type = board.piece_type_at(square)
    return 0.0 if piece_type is None else PIECE_VALUES[piece_type]


def exchange_loss(board: chess.Board, square: chess.Square, owner: chess.Color) -> float:
    """Rough material ``owner`` stands to lose on ``square`` (no x-rays or pins)."""
    piece_type = board.piece_type_at(square)
    if piece_type is None or piece_type == chess.KING:
        return 0.0
    attackers = board.attackers(not owner, square)
    if not attackers:
        return 0.0
    value = PIECE_VALUES[piece_type]
    if not board.attackers(owner, square):
        return value
    cheapest = min(
        (_value_at(board, attacker) for attacker in attackers if board.piece_type_at(attacker) != chess.KING),
        default=None,
    )
    if cheapest is None:
        return 0.0  # only the king attacks a defended piece
    return max(0.0, value - cheapest)


def _centrality(square: chess.Square) -> float:
    file_distance = abs(chess.square_file(square) - 3.5)
    rank_distance = abs(chess.square_rank(square) - 3.5)
    return 3.5 - max(file_distance, rank_distance)


def _undeveloped_minors(board: chess.Board, color: chess.Color) -> int:
    home = chess.BB_RANK_1 if color == chess.WHITE else chess.BB_RANK_8
    minors = board.pieces_mask(chess.KNIGHT, color) | board.pieces_mask(chess.BISHOP, color)
    return chess.popcount(minors & home)


def _development_score(board: chess.Board, move: chess.Move, piece_type: chess.PieceType) -> float:
    color = board.turn
    ply = len(board.move_stack)
    home_rank = 0 if color == chess.WHITE else 7
    pawn_rank = 1 if color == chess.WHITE else 6
    from_rank = chess.square_rank(move.from_square)
    if piece_type == chess.PAWN:
        if from_rank != pawn_rank:
            return 0.2
        double = abs(chess.square_rank(move.to_square) - from_rank) == 2
        bonus = PAWN_START_BONUS[chess.square_file(move.from_square)][1 if double else 0]
        if ply >= OPENING_PLIES // 2:
            bonus *= 0.5
        if ply >= 8 and _undeveloped_minors(board, color) >= 3:
            bonus -= 0.5
        return bonus
    retreat = chess.square_rank(move.to_square) == home_rank and from_rank != home_rank
    if piece_type == chess.KNIGHT:
        if from_rank != home_rank:
            return -1.9 if retreat else -0.9
        if move.to_square in KNIGHT_SQUARES[color]:
            return 2.2
        return -0.8 if chess.square_file(move.to_square) in (0, 7) else 0.7
    if piece_type == chess.BISHOP:
        if from_rank != home_rank:
            return -1.7 if retreat else -0.7
        return 1.8
    if piece_type == chess.QUEEN:
        return -2.2 if ply < 14 else -0.6
    if piece_type == chess.ROOK:
        king = board.king(color)
        castled = king is not None and king in (chess.square(2, home_rank), chess.square(6, home_rank))
        return -0.3 if castled else -1.5
    return 0.0


def score_move(
    board: chess.Board,
    move: chess.Move,
    *,
    prev_capture: bool = False,
    capture_bias: float = 0.0,
) -> float | None:
    """Heuristic desirability of ``move``; ``None`` if it would end the game."""
    piece = board.piece_at(move.from_square)
    if piece is None:
        return None
    us = board.turn
    piece_type = piece.piece_type
    ply = len(board.move_stack)
    in_check = board.is_check()
    victim_value = 1.0 if board.is_en_passant(move) else _value_at(board, move.to_square)
    is_capture = victim_value > 0
    previous = board.move_stack[-1] if board.move_stack else None
    own_previous = board.move_stack[-2] if len(board.move_stack) >= 2 else None

    score = 0.0
    if board.is_castling(move):
        score += 4.5 if chess.square_file(move.to_square) == 6 else 2.5
    elif piece_type == chess.KING:
        if not in_check:
            score -= 3.5 if ply < 60 else 0.5
        elif board.has_castling_rights(us):
            score -= 1.5  # prefer blocking a check to giving up castling
    if move.promotion is not None:
        score += 6.0 if move.promotion == chess.QUEEN else -4.0
    if not is_capture:
        if ply < OPENING_PLIES:
            score += _development_score(board, move, piece_type)
        elif piece_type in (chess.KNIGHT, chess.BISHOP, chess.QUEEN):
            score += 0.15 * (_centrality(move.to_square) - _centrality(move.from_square))
    if (
        own_previous is not None
        and own_previous.to_square == move.from_square
        and own_previous.from_square == move.to_square
    ):
        score -= 1.5  # shuffling back and forth

    board.push(move)
    try:
        if board.is_insufficient_material() or not any(board.generate_legal_moves()):
            return None
        gives_check = board.is_check()
        them = not us
        moved_loss = exchange_loss(board, move.to_square, us)
        other_loss = 0.0
        for square in chess.scan_forward(board.occupied_co[us] & ~board.kings):
            if square != move.to_square and board.is_attacked_by(them, square):
                other_loss = max(other_loss, exchange_loss(board, square, us))
        threat = 0.0
        for square in chess.scan_forward(board.attacks_mask(move.to_square) & board.occupied_co[them]):
            threat = max(threat, exchange_loss(board, square, them))
    finally:
        board.pop()

    net = victim_value - moved_loss
    score += 1.6 * net
    if is_capture:
        if previous is not None and move.to_square == previous.to_square:
            score += 2.0 if prev_capture else 1.0
        if net >= 0:
            score += 0.5 + capture_bias
    score -= 1.2 * other_loss
    score += 0.25 * min(threat, 3.0)
    if gives_check and net >= 0:
        score += 0.4
    return score


def choose_move(
    board: chess.Board,
    rng: random.Random,
    *,
    prev_capture: bool = False,
    capture_bias: float = 0.0,
) -> chess.Move | None:
    """Sample a natural move, or ``None`` if every legal move ends the game."""
    scored: list[tuple[chess.Move, float]] = []
    for move in sorted(board.legal_moves, key=lambda candidate: candidate.uci()):
        score = score_move(board, move, prev_capture=prev_capture, capture_bias=capture_bias)
        if score is not None:
            scored.append((move, score))
    if not scored:
        return None
    best = max(score for _, score in scored)
    candidates = [(move, score) for move, score in scored if score >= best - MARGIN]
    weights = [math.exp((score - best) / TEMPERATURE) for _, score in candidates]
    return rng.choices([move for move, _ in candidates], weights=weights)[0]


def generate_game(plies: int, seed: int) -> GeneratedGame:
    """A natural-looking game of exactly ``plies`` half-moves from the start position."""
    if plies < 1:
        msg = "plies must be positive"
        raise ValueError(msg)
    rng = random.Random(seed)
    for _ in range(MAX_ATTEMPTS):
        board = chess.Board()
        san: list[str] = []
        prev_capture = False
        while len(board.move_stack) < plies:
            move = choose_move(board, rng, prev_capture=prev_capture)
            if move is None:
                break  # cornered into ending the game early: resample
            prev_capture = board.is_capture(move)
            san.append(board.san(move))
            board.push(move)
        if len(board.move_stack) == plies:
            return GeneratedGame(seed=seed, moves=tuple(board.move_stack), san=tuple(san), board=board)
    msg = f"could not generate {plies} plies for seed {seed}"
    raise RuntimeError(msg)
