import csv
import json
from collections import Counter
from pathlib import Path

import pytest
import zstandard

import build_puzzles
from build_puzzles import FilterConfig, SourceError, build, convert_row, iter_rows, main, open_puzzle_csv
from puzzlelib import (
    LineCheck,
    PuzzleEntry,
    StratifiedReservoir,
    allocate,
    balanced_quotas,
    check_line,
    clean_themes,
    goal_for,
    rating_bucket,
    stratified_sample,
)

SAMPLE = Path(__file__).parent / "fixtures" / "lichess_sample.csv"
KEPT = {
    "0008Q": "win",
    "000Pw": "win",
    "000Zo": "mate2",
    "001cr": "mate1",
    "001m3": "win",
    "001wR": "mate3",
    "002vV": "mate1",
    "003Tx": "mate2",
    "0048x": "mate3",
}
REJECTED = {
    "00008": "long_theme",
    "0000D": "pieces",
    "0000H": "plays",
    "0009B": "pieces",
    "000VW": "rating_deviation",
    "000Vc": "popularity",
    "000h0": "too_many_moves",
    "00Dib": "no_goal",
    "zzIll": "invalid_line",
    "zzMis": "goal_mismatch",
    "zzBad": "malformed",
}


def sample_rows() -> list[dict[str, str]]:
    with SAMPLE.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_convert_row_keeps_and_rejects_for_the_right_reasons() -> None:
    rows = sample_rows()
    assert {row["PuzzleId"] for row in rows} == set(KEPT) | set(REJECTED)
    for row in rows:
        stats: Counter[str] = Counter()
        entry = convert_row(row, stats=stats)
        puzzle_id = row["PuzzleId"]
        if puzzle_id in KEPT:
            assert entry is not None, (puzzle_id, stats)
            assert entry.goal == KEPT[puzzle_id]
            assert stats == Counter({"kept": 1})
        else:
            assert entry is None
            assert stats == Counter({REJECTED[puzzle_id]: 1}), puzzle_id


def test_converted_entry_matches_the_output_format() -> None:
    row = next(row for row in sample_rows() if row["PuzzleId"] == "002vV")
    entry = convert_row(row)
    assert entry is not None
    assert entry.to_json() == {
        "id": "002vV",
        "fen": "8/6k1/2R4p/5p1P/5P1K/6P1/8/r7 w - - 2 58",
        "moves": ["c6b6", "a1h1"],
        "rating": 511,
        "themes": ["endgame", "mateIn1", "rookEndgame"],  # "mate", "master", "oneMove" dropped
        "pieces": 9,
        "goal": "mate1",
    }


def test_mate_in_three_is_kept_despite_the_long_theme() -> None:
    row = next(row for row in sample_rows() if row["PuzzleId"] == "001wR")
    assert "long" in row["Themes"].split()
    entry = convert_row(row)
    assert entry is not None
    assert entry.goal == "mate3"
    assert "long" not in entry.themes


def test_thresholds_are_configurable() -> None:
    row = next(row for row in sample_rows() if row["PuzzleId"] == "0000H")
    assert convert_row(row) is None
    assert convert_row(row, FilterConfig(min_plays=50, max_pieces=32)) is not None


def test_check_line_and_goal() -> None:
    fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1"
    line = check_line(fen, ["g8h8", "a1a8"])
    assert line == LineCheck(pieces=9, solver_moves=1, checkmate=True)
    assert goal_for(["mateIn1"], line) == "mate1"
    assert goal_for(["mateIn2"], line) is None  # tag disagrees with the board
    assert goal_for(["crushing"], line) == "mate1"  # the board decides
    assert check_line(fen, ["g8h8"]) is None  # odd length
    assert check_line(fen, ["g8h8", "a1a9"]) is None
    assert check_line("garbage", ["a1a2", "a2a3"]) is None
    quiet = check_line(fen, ["g8h8", "a1a2"])
    assert quiet is not None
    assert goal_for(["advantage"], quiet) == "win"
    assert goal_for(["equality"], quiet) is None


def test_clean_themes() -> None:
    themes = ["mate", "mateIn2", "short", "masterVsMaster", "superGM", "fork", "endgame", "oneMove"]
    assert clean_themes(themes, "mate2") == ("endgame", "fork", "mateIn2")
    assert clean_themes(["crushing", "long"], "win") == ("crushing",)
    assert clean_themes(["crushing"], "mate3") == ("crushing", "mateIn3")


def test_rating_buckets() -> None:
    assert [rating_bucket(r) for r in (400, 1000, 1001, 1400, 1800, 2200, 2201, 3100)] == [
        0,
        0,
        1,
        1,
        2,
        3,
        4,
        4,
    ]


def test_allocate_is_water_filling() -> None:
    assert allocate({"a": 10, "b": 10, "c": 10}, 9) == {"a": 3, "b": 3, "c": 3}
    assert allocate({"a": 1, "b": 10, "c": 10}, 9) == {"a": 1, "b": 4, "c": 4}
    assert allocate({"a": 2, "b": 2}, 10) == {"a": 2, "b": 2}
    assert allocate({"a": 5, "b": 5, "c": 0}, 3) == {"a": 2, "b": 1, "c": 0}
    assert allocate({}, 5) == {}


def test_balanced_quotas_balance_goals_first() -> None:
    capacities = {("mate1", 0, 0): 100, ("mate1", 1, 0): 1, ("win", 0, 0): 50, ("win", 2, 3): 50}
    quotas = balanced_quotas(capacities, 40)
    assert quotas[("mate1", 0, 0)] + quotas[("mate1", 1, 0)] == 20
    assert quotas[("mate1", 1, 0)] == 1
    assert quotas[("win", 0, 0)] == quotas[("win", 2, 3)] == 10


def make_entries(count: int) -> list[PuzzleEntry]:
    goals = ("mate1", "mate2", "mate3", "win")
    return [
        PuzzleEntry(
            id=f"p{index:04d}",
            fen="8/8/8/8/8/8/8/8 w - - 0 1",
            moves=("a1a2", "a2a3"),
            rating=600 + (index * 37) % 2000,
            themes=(),
            pieces=3 + index % 14,
            goal=goals[index % 4],
        )
        for index in range(count)
    ]


def test_stratified_sample_is_deterministic_and_nested() -> None:
    entries = make_entries(800)
    big = stratified_sample(entries, 200, seed=1)
    assert big == stratified_sample(list(reversed(entries)), 200, seed=1)
    small = stratified_sample(big, 60, seed=1)
    assert {e.id for e in small} <= {e.id for e in big}
    assert Counter(e.goal for e in big) == dict.fromkeys(("mate1", "mate2", "mate3", "win"), 50)
    assert stratified_sample(entries, 200, seed=2) != big


def test_reservoir_matches_the_in_memory_sample() -> None:
    entries = make_entries(500)
    reservoir = StratifiedReservoir(seed=4, per_cell=50)
    for entry in entries:
        reservoir.add(entry)
    assert sum(reservoir.counts.values()) == 500
    assert reservoir.sample(120) == stratified_sample(entries, 120, seed=4)


def write_zst(source: Path, destination: Path) -> Path:
    destination.write_bytes(zstandard.ZstdCompressor().compress(source.read_bytes()))
    return destination


def test_build_from_csv_and_zst_agree(tmp_path: Path) -> None:
    plain = build(SAMPLE, seed=3, total=100)
    compressed = build(write_zst(SAMPLE, tmp_path / "sample.csv.zst"), seed=3, total=100)
    assert plain.backend == compressed.backend
    assert {entry.id for entry in plain.backend} == set(KEPT)
    assert plain.stats["rows"] == 20
    assert plain.stats["kept"] == len(KEPT)
    limited = build(SAMPLE, seed=3, total=100, limit_rows=5)
    assert limited.stats["rows"] == 5


def test_iter_rows_validates_the_header(tmp_path: Path) -> None:
    bad = tmp_path / "bad.csv"
    bad.write_text("Foo,Bar\n1,2\n")
    with open_puzzle_csv(bad) as handle, pytest.raises(SourceError, match="lacks columns"):
        list(iter_rows(handle))
    empty = tmp_path / "empty.csv"
    empty.write_text("")
    with open_puzzle_csv(empty) as handle, pytest.raises(SourceError, match="empty"):
        list(iter_rows(handle))


def test_corrupt_zst_is_a_source_error(tmp_path: Path) -> None:
    broken = tmp_path / "broken.csv.zst"
    broken.write_bytes(b"definitely not zstd")
    with pytest.raises(SourceError, match="cannot read"):
        build(broken)


def test_main_writes_both_files(tmp_path: Path) -> None:
    backend = tmp_path / "backend.json"
    frontend = tmp_path / "front" / "puzzles.json"
    argv = ["--input", str(SAMPLE), "--output", str(backend), "--frontend-output", str(frontend)]
    argv += ["--total", "8", "--frontend-total", "4", "--generated", "2026-01-01", "--no-fallback"]
    assert main(argv) == 0
    data = json.loads(backend.read_text())
    assert data["version"] == 1
    assert data["source"] == "Lichess puzzle database (database.lichess.org), CC0"
    assert data["generated"] == "2026-01-01"
    assert data["count"] == len(data["puzzles"]) == 8
    assert {p["goal"] for p in data["puzzles"]} == {"mate1", "mate2", "mate3", "win"}
    front = json.loads(frontend.read_text())
    assert front["count"] == 4
    assert {p["id"] for p in front["puzzles"]} <= {p["id"] for p in data["puzzles"]}
    assert "\n " not in frontend.read_text()


def test_main_falls_back_to_the_generator(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import generate_puzzles

    calls: list[list[str]] = []

    def fake_main(argv: list[str]) -> int:
        calls.append(argv)
        return 0

    monkeypatch.setattr(generate_puzzles, "main", fake_main)
    output = tmp_path / "out.json"
    assert main(["--input", str(tmp_path / "missing.csv"), "--output", str(output), "--no-frontend"]) == 0
    assert calls
    assert calls[0][:2] == ["--output", str(output)]
    assert "--no-frontend" in calls[0]
    assert main(["--input", str(tmp_path / "missing.csv"), "--no-fallback"]) == 1


def test_resolve_source_uses_the_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    cached = tmp_path / "lichess_db_puzzle.csv.zst"
    cached.write_bytes(b"x")

    def no_download(url: str, destination: Path, *, timeout: float = 60.0) -> Path:
        raise AssertionError("should not download")

    monkeypatch.setattr(build_puzzles, "download", no_download)
    assert build_puzzles.resolve_source(None, build_puzzles.LICHESS_URL, tmp_path) == cached


def test_resolve_source_downloads_into_the_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    payload = SAMPLE.read_bytes()

    class FakeResponse:
        def __init__(self) -> None:
            self.offset = 0

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def read(self, size: int = -1) -> bytes:
            chunk = payload[self.offset :] if size < 0 else payload[self.offset : self.offset + size]
            self.offset += len(chunk)
            return chunk

    monkeypatch.setattr(build_puzzles.urllib.request, "urlopen", lambda *a, **k: FakeResponse())
    path = build_puzzles.resolve_source(None, "https://example.org/sample.csv", tmp_path / "cache")
    assert path == tmp_path / "cache" / "sample.csv"
    assert path.read_bytes() == payload
    assert not (tmp_path / "cache" / "sample.csv.part").exists()
