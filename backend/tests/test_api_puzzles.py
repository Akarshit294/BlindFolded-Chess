from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import __version__

PUZZLE_KEYS = {"id", "fen", "moves", "rating", "themes", "pieces", "goal"}


def get_json(client: TestClient, url: str, status: int = 200) -> Any:
    response = client.get(url)
    assert response.status_code == status, response.text
    assert response.headers["content-type"].startswith("application/json")
    return response.json()


def test_health_without_engine(client: TestClient) -> None:
    assert get_json(client, "/api/health") == {
        "status": "ok",
        "version": __version__,
        "engine": False,
        "puzzles": 4000,
    }


def test_index_points_to_the_docs(client: TestClient) -> None:
    body = get_json(client, "/")
    assert body["docs"] == "/api/docs"
    assert client.get("/api/openapi.json").status_code == 200


def test_unknown_route_is_json_404(client: TestClient) -> None:
    assert get_json(client, "/api/nope", status=404) == {"detail": "Not Found"}


def test_list_defaults(client: TestClient) -> None:
    body = get_json(client, "/api/puzzles")
    assert body["total"] == 4000
    assert len(body["items"]) == 20
    assert set(body["items"][0]) == PUZZLE_KEYS
    ratings = [item["rating"] for item in body["items"]]
    assert ratings == sorted(ratings)  # file order: easiest first


@pytest.mark.parametrize("goal", ["mate1", "mate2", "mate3", "win"])
def test_list_by_goal(client: TestClient, goal: str) -> None:
    body = get_json(client, f"/api/puzzles?goal={goal}&limit=100")
    assert body["total"] == 1000
    assert {item["goal"] for item in body["items"]} == {goal}


def test_list_filters_combine(client: TestClient) -> None:
    url = "/api/puzzles?goal=mate2&min_rating=1200&max_rating=1600&min_pieces=5&max_pieces=9&limit=100"
    body = get_json(client, url)
    assert 0 < body["total"] <= 1000
    for item in body["items"]:
        assert item["goal"] == "mate2"
        assert 1200 <= item["rating"] <= 1600
        assert 5 <= item["pieces"] <= 9


def test_theme_filter_is_case_insensitive(client: TestClient) -> None:
    lower = get_json(client, "/api/puzzles?theme=fork&limit=5")
    upper = get_json(client, "/api/puzzles?theme=FORK&limit=5")
    assert lower == upper
    assert lower["total"] > 0
    assert all("fork" in item["themes"] for item in lower["items"])


def test_seeded_shuffle_is_stable_across_pages(client: TestClient) -> None:
    first = get_json(client, "/api/puzzles?seed=42&limit=10")
    again = get_json(client, "/api/puzzles?seed=42&limit=10")
    second_page = get_json(client, "/api/puzzles?seed=42&limit=10&offset=10")
    both = get_json(client, "/api/puzzles?seed=42&limit=20")
    assert first == again
    assert both["items"] == first["items"] + second_page["items"]
    unseeded = get_json(client, "/api/puzzles?limit=10")
    assert first["items"] != unseeded["items"]


def test_offset_past_the_end(client: TestClient) -> None:
    body = get_json(client, "/api/puzzles?goal=win&offset=5000")
    assert body == {"total": 1000, "items": []}


@pytest.mark.parametrize(
    "query",
    [
        "limit=0",
        "limit=101",
        "offset=-1",
        "goal=mate4",
        "min_rating=-5",
        "max_rating=99999",
        "min_pieces=1",
        "max_pieces=33",
        "theme=no%20spaces",
        "seed=-1",
        "min_rating=1500&max_rating=1000",
        "min_pieces=9&max_pieces=4",
    ],
)
def test_invalid_queries_are_422(client: TestClient, query: str) -> None:
    body = get_json(client, f"/api/puzzles?{query}", status=422)
    assert isinstance(body["detail"], list)
    assert body["detail"][0]["loc"][0] == "query"


def test_random_is_seeded(client: TestClient) -> None:
    first = get_json(client, "/api/puzzles/random?seed=5&goal=mate3")
    assert first == get_json(client, "/api/puzzles/random?seed=5&goal=mate3")
    assert first["goal"] == "mate3"
    assert set(first) == PUZZLE_KEYS


def test_random_without_seed_returns_matching_puzzles(client: TestClient) -> None:
    for _ in range(5):
        body = get_json(client, "/api/puzzles/random?goal=win&max_pieces=8")
        assert body["goal"] == "win"
        assert body["pieces"] <= 8


def test_random_excludes_ids(small_client: TestClient) -> None:
    listing = get_json(small_client, "/api/puzzles?goal=mate1")
    ids = [item["id"] for item in listing["items"]]
    assert len(ids) == 2
    for seed in range(10):
        body = get_json(small_client, f"/api/puzzles/random?goal=mate1&seed={seed}&exclude={ids[0]}")
        assert body["id"] == ids[1]
    get_json(small_client, f"/api/puzzles/random?goal=mate1&exclude={ids[0]},{ids[1]}", status=404)


def test_random_404_when_nothing_matches(client: TestClient) -> None:
    body = get_json(client, "/api/puzzles/random?min_rating=4000", status=404)
    assert body == {"detail": "no puzzle matches the filters"}


def test_meta_of_the_real_set(client: TestClient) -> None:
    meta = get_json(client, "/api/puzzles/meta")
    assert meta["count"] == 4000
    assert meta["goals"] == {"mate1": 1000, "mate2": 1000, "mate3": 1000, "win": 1000}
    assert meta["pieces"]["min"] >= 3
    assert meta["pieces"]["max"] <= 16
    assert meta["rating"]["min"] < meta["rating"]["max"]
    counts = list(meta["themes"].values())
    assert counts == sorted(counts, reverse=True)
    assert "short" not in meta["themes"]
    assert "mate" not in meta["themes"]


def test_meta_of_the_small_set(small_client: TestClient) -> None:
    meta = get_json(small_client, "/api/puzzles/meta")
    assert meta["count"] == 9
    assert meta["goals"] == {"mate1": 2, "mate2": 2, "mate3": 2, "win": 3}
    assert meta["rating"] == {"min": 535, "max": 2081}
    assert meta["pieces"] == {"min": 6, "max": 12}
    assert meta["themes"]["mateIn1"] == 2


def test_get_by_id(small_client: TestClient) -> None:
    body = get_json(small_client, "/api/puzzles/WYcMT")
    assert body["id"] == "WYcMT"
    assert body["goal"] == "mate2"
    assert body["pieces"] == 6
    assert body["moves"][0] == body["moves"][0].lower()


def test_unknown_id_is_404(small_client: TestClient) -> None:
    assert get_json(small_client, "/api/puzzles/zzzzz", status=404) == {"detail": "puzzle not found"}


def test_cors_allows_any_origin_by_default(client: TestClient) -> None:
    response = client.options(
        "/api/puzzles",
        headers={"Origin": "https://example.org", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
    assert "access-control-allow-credentials" not in response.headers
    simple = client.get("/api/health", headers={"Origin": "https://example.org"})
    assert simple.headers["access-control-allow-origin"] == "*"


def test_cors_restricted_origins() -> None:
    from app.config import Settings
    from app.main import create_app

    settings = Settings(engine_enabled=False, cors_origins=("https://blindfold.example",))
    with TestClient(create_app(settings)) as restricted:
        allowed = restricted.options(
            "/api/analysis",
            headers={"Origin": "https://blindfold.example", "Access-Control-Request-Method": "POST"},
        )
        assert allowed.headers["access-control-allow-origin"] == "https://blindfold.example"
        denied = restricted.options(
            "/api/analysis",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
        )
        assert denied.status_code == 400
        assert "access-control-allow-origin" not in denied.headers
