import re
from typing import Any

import chess
import pytest
from fastapi.testclient import TestClient

SIDE_PATTERN = re.compile(
    r"^(White|Black): K[a-h][1-8]"
    r"(, Q[a-h][1-8])*(, R[a-h][1-8])*(, B[a-h][1-8])*(, N[a-h][1-8])*"
    r"(, (pawn [a-h][1-8]|pawns [a-h][1-8]( [a-h][1-8])+))?\.$",
)


def get_json(client: TestClient, url: str, status: int = 200) -> Any:
    response = client.get(url)
    assert response.status_code == status, response.text
    return response.json()


def test_sequence_defaults_and_shape(client: TestClient) -> None:
    body = get_json(client, "/api/drills/sequence?seed=123")
    assert set(body) == {"seed", "plies", "san", "uci", "fen"}
    assert body["seed"] == 123
    assert body["plies"] == 10
    assert len(body["san"]) == len(body["uci"]) == 10
    board = chess.Board()
    for uci, san in zip(body["uci"], body["san"], strict=True):
        move = chess.Move.from_uci(uci)
        assert board.san(move) == san
        board.push(move)
    assert board.fen() == body["fen"]


def test_sequence_is_deterministic(client: TestClient) -> None:
    first = get_json(client, "/api/drills/sequence?plies=40&seed=7")
    assert first == get_json(client, "/api/drills/sequence?plies=40&seed=7")
    assert first != get_json(client, "/api/drills/sequence?plies=40&seed=8")


def test_sequence_without_seed_reports_a_reusable_seed(client: TestClient) -> None:
    body = get_json(client, "/api/drills/sequence?plies=12")
    assert isinstance(body["seed"], int)
    assert get_json(client, f"/api/drills/sequence?plies=12&seed={body['seed']}") == body


@pytest.mark.parametrize("plies", [0, 1, 41, 100])
def test_sequence_plies_bounds(client: TestClient, plies: int) -> None:
    get_json(client, f"/api/drills/sequence?plies={plies}", status=422)


def test_sequence_accepts_javascript_safe_seeds(client: TestClient) -> None:
    get_json(client, f"/api/drills/sequence?seed={2**53 - 1}")
    get_json(client, f"/api/drills/sequence?seed={2**53}", status=422)


def test_knight_route_shape(client: TestClient) -> None:
    body = get_json(client, "/api/drills/knight-route?seed=11")
    assert set(body) == {"seed", "from", "to", "distance", "path", "shortest_paths"}
    assert body["seed"] == 11
    assert 2 <= body["distance"] <= 5
    assert body["path"][0] == body["from"]
    assert body["path"][-1] == body["to"]
    assert len(body["path"]) == body["distance"] + 1
    assert body["shortest_paths"] >= 1
    for a, b in zip(body["path"], body["path"][1:], strict=False):
        assert chess.parse_square(b) in chess.SquareSet(chess.BB_KNIGHT_ATTACKS[chess.parse_square(a)])
    assert body == get_json(client, "/api/drills/knight-route?seed=11")


@pytest.mark.parametrize(("low", "high"), [(1, 1), (6, 6), (3, 4), (1, 6)])
def test_knight_route_distance_range(client: TestClient, low: int, high: int) -> None:
    for seed in range(5):
        body = get_json(client, f"/api/drills/knight-route?seed={seed}&min_moves={low}&max_moves={high}")
        assert low <= body["distance"] <= high


@pytest.mark.parametrize("query", ["min_moves=0", "max_moves=7", "min_moves=4&max_moves=3"])
def test_knight_route_invalid_bounds(client: TestClient, query: str) -> None:
    body = get_json(client, f"/api/drills/knight-route?{query}", status=422)
    assert body["detail"][0]["loc"][0] == "query"


@pytest.mark.parametrize("pieces", [3, 4, 6, 9, 12, 16, 17, 22, 28, 32])
def test_position_drill(client: TestClient, pieces: int) -> None:
    body = get_json(client, f"/api/drills/position?pieces={pieces}&seed=21")
    assert set(body) == {"seed", "fen", "pieces", "description"}
    board = chess.Board(body["fen"])
    assert board.is_valid()
    assert body["pieces"] == pieces == chess.popcount(board.occupied)
    white, black = body["description"].split(". Black: ")
    assert SIDE_PATTERN.match(white + ".")
    assert SIDE_PATTERN.match("Black: " + black)
    assert body == get_json(client, f"/api/drills/position?pieces={pieces}&seed=21")


def test_position_drill_uses_puzzle_positions(small_client: TestClient) -> None:
    body = get_json(small_client, "/api/drills/position?pieces=12&seed=1")
    puzzles = get_json(small_client, "/api/puzzles?min_pieces=12&max_pieces=12")["items"]
    solver_fens = set()
    for puzzle in puzzles:
        board = chess.Board(puzzle["fen"])
        board.push_uci(puzzle["moves"][0])
        solver_fens.add(board.fen())
    assert body["fen"] in solver_fens


def test_position_drill_default_and_bounds(client: TestClient) -> None:
    assert get_json(client, "/api/drills/position")["pieces"] == 6
    get_json(client, "/api/drills/position?pieces=2", status=422)
    get_json(client, "/api/drills/position?pieces=33", status=422)
