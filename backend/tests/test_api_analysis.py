from typing import Any

import chess
import pytest
from fastapi.testclient import TestClient

from app.services.accuracy import CLASSIFICATIONS

SCHOLAR = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"]


def analyse(client: TestClient, payload: dict[str, Any], status: int = 200) -> Any:
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == status, response.text
    return response.json()


def test_engine_unavailable_is_503(client: TestClient) -> None:
    assert analyse(client, {"moves": ["e2e4"]}, status=503) == {"detail": "engine unavailable"}


@pytest.mark.parametrize(
    ("payload", "location"),
    [
        ({"moves": ["e2e4", "e7e5", "e4e5"]}, ["body", "moves", 2]),
        ({"moves": ["e2e5"]}, ["body", "moves", 0]),
        ({"moves": ["e7e8"]}, ["body", "moves", 0]),
        ({"moves": ["0000"]}, ["body", "moves", 0]),
        ({"moves": ["e2e4x"]}, ["body", "moves", 0]),
        ({"moves": [], "depth": 5}, ["body", "depth"]),
        ({"moves": [], "depth": 19}, ["body", "depth"]),
        ({"moves": ["e2e4"] * 301}, ["body", "moves"]),
        ({"moves": [], "initial_fen": "not a fen"}, ["body", "initial_fen"]),
        ({"moves": [], "initial_fen": "8/8/8/8/8/8/8/8 w - - 0 1"}, ["body", "initial_fen"]),
    ],
)
def test_validation_errors_are_422(client: TestClient, payload: dict[str, Any], location: list[Any]) -> None:
    body = analyse(client, payload, status=422)
    assert body["detail"][0]["loc"] == location


def test_missing_body_is_422(client: TestClient) -> None:
    response = client.post("/api/analysis", content=b"nope", headers={"content-type": "application/json"})
    assert response.status_code == 422


@pytest.mark.requires_stockfish
def test_health_reports_engine(engine_client: TestClient) -> None:
    assert engine_client.get("/api/health").json()["engine"] is True


@pytest.mark.requires_stockfish
def test_full_analysis_shape(engine_client: TestClient) -> None:
    body = analyse(engine_client, {"moves": SCHOLAR, "depth": 8})
    assert body["engine"].startswith("Stockfish")
    assert body["depth"] == 8
    assert set(body["initial"]) == {"cp", "mate", "win", "best_uci", "best_san"}
    assert len(body["plies"]) == len(SCHOLAR)
    board = chess.Board()
    for index, (ply, uci) in enumerate(zip(body["plies"], SCHOLAR, strict=True), start=1):
        assert ply["ply"] == index
        assert ply["color"] == ("w" if index % 2 else "b")
        assert ply["uci"] == uci
        assert ply["san"] == board.san(chess.Move.from_uci(uci))
        assert ply["classification"] in CLASSIFICATIONS
        assert 0 <= ply["win"] <= 100
        assert 0 <= ply["accuracy"] <= 100
        assert ply["drop"] >= 0
        assert ply["best_uci"] is not None
        board.push_uci(uci)
    for side in ("white", "black"):
        assert sum(body["counts"][side].values()) == (4 if side == "white" else 3)
        assert set(body["counts"][side]) == set(CLASSIFICATIONS)
        assert 0 <= body["accuracy"][side] <= 100


@pytest.mark.requires_stockfish
def test_checkmate_is_scored_without_the_engine(engine_client: TestClient) -> None:
    body = analyse(engine_client, {"moves": SCHOLAR, "depth": 6})
    last = body["plies"][-1]
    assert last["san"] == "Qxf7#"
    assert last["mate"] == 0
    assert last["cp"] is None
    assert last["win"] == 100.0
    # Black's 3...Nf6?? allows mate in one: a blunder from Black's point of view.
    assert body["plies"][-2]["classification"] == "blunder"
    fools = analyse(engine_client, {"moves": ["f2f3", "e7e5", "g2g4", "d8h4"], "depth": 6})
    assert fools["plies"][-1]["win"] == 0.0
    assert fools["plies"][-1]["classification"] == "best"
    assert fools["accuracy"]["black"] == 100.0


@pytest.mark.requires_stockfish
def test_stalemate_is_a_draw(engine_client: TestClient) -> None:
    # White to play Qg6 stalemates the black king on h8.
    body = analyse(
        engine_client, {"initial_fen": "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", "moves": ["g1g6"], "depth": 6}
    )
    ply = body["plies"][0]
    assert ply["cp"] == 0
    assert ply["mate"] is None
    assert ply["win"] == 50.0
    assert ply["classification"] == "blunder"  # threw away a mate
    assert body["initial"]["mate"] is not None
    assert body["initial"]["mate"] > 0


@pytest.mark.requires_stockfish
def test_empty_game_and_custom_start(engine_client: TestClient) -> None:
    body = analyse(engine_client, {"moves": [], "depth": 6})
    assert body["plies"] == []
    assert body["accuracy"] == {"white": None, "black": None}
    assert body["initial"]["best_uci"] is not None
    black_to_move = analyse(
        engine_client,
        {"initial_fen": "6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1", "moves": ["g8h8", "a1a8"], "depth": 8},
    )
    assert [ply["color"] for ply in black_to_move["plies"]] == ["b", "w"]
    assert black_to_move["plies"][1]["san"] == "Ra8#"
    assert black_to_move["accuracy"]["white"] is not None


@pytest.mark.requires_stockfish
def test_playing_the_engine_move_is_best(engine_client: TestClient) -> None:
    first = analyse(engine_client, {"moves": [], "depth": 8})
    best = first["initial"]["best_uci"]
    body = analyse(engine_client, {"moves": [best], "depth": 8})
    assert body["plies"][0]["best_uci"] == best
    assert body["plies"][0]["classification"] in {"best", "inaccuracy", "mistake", "blunder"}
    if body["plies"][0]["drop"] < 5:
        assert body["plies"][0]["classification"] == "best"


@pytest.mark.requires_stockfish
def test_uppercase_and_castling_moves_are_normalised(engine_client: TestClient) -> None:
    moves = ["E2E4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "e1g1"]
    body = analyse(engine_client, {"moves": moves, "depth": 6})
    assert body["plies"][0]["uci"] == "e2e4"
    assert body["plies"][-1]["san"] == "O-O"
