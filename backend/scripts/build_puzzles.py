"""Build the bundled puzzle sets from the Lichess puzzle database (CC0).

Usage (from ``backend/``)::

    uv run python scripts/build_puzzles.py --input /path/to/lichess_db_puzzle.csv.zst
    uv run python scripts/build_puzzles.py            # downloads into scripts/.cache/

The CSV is streamed (zstd-decompressed on the fly) and filtered to short, popular,
low-material puzzles suited to blindfold play. Every candidate is replayed with
python-chess, then a deterministic stratified sample is written to
``app/data/puzzles.json`` (~4000 puzzles) and a balanced subset of it to
``../frontend/public/data/puzzles.json`` (~1200 puzzles, < 250 KB).

If the database cannot be read or downloaded, the script falls back to
``generate_puzzles.py`` (Stockfish if available, else a pure-Python mate search).
"""

from __future__ import annotations

import argparse
import csv
import io
import logging
import shutil
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Final, TextIO

import zstandard

from puzzlelib import (
    LICHESS_SOURCE,
    MATE_THEMES,
    WIN_THEMES,
    PuzzleEntry,
    StratifiedReservoir,
    check_line,
    clean_themes,
    fit_sample,
    goal_for,
    summarize,
    today,
    write_puzzle_file,
)

LOG = logging.getLogger("build_puzzles")

LICHESS_URL: Final = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
BACKEND_DIR: Final = Path(__file__).resolve().parent.parent
CACHE_DIR: Final = BACKEND_DIR / "scripts" / ".cache"
DEFAULT_OUTPUT: Final = BACKEND_DIR / "app" / "data" / "puzzles.json"
DEFAULT_FRONTEND_OUTPUT: Final = BACKEND_DIR.parent / "frontend" / "public" / "data" / "puzzles.json"
REQUIRED_COLUMNS: Final = (
    "PuzzleId",
    "FEN",
    "Moves",
    "Rating",
    "RatingDeviation",
    "Popularity",
    "NbPlays",
    "Themes",
)
DEFAULT_SEED: Final = 2026
DEFAULT_TOTAL: Final = 4000
DEFAULT_FRONTEND_TOTAL: Final = 1200
DEFAULT_FRONTEND_MAX_KB: Final = 245


class SourceError(RuntimeError):
    """The puzzle database could not be downloaded or read."""


@dataclass(frozen=True, slots=True)
class FilterConfig:
    """Selection criteria (see NOTES.md for the rationale)."""

    max_rating_deviation: int = 90
    min_popularity: int = 80
    min_plays: int = 200
    max_moves: int = 6
    """Setup move + at most three solver moves (with two replies)."""
    min_pieces: int = 3
    max_pieces: int = 16


DEFAULT_FILTER: Final = FilterConfig()


def _is_too_long(themes: set[str]) -> bool:
    # Lichess tags every three-solver-move puzzle as "long", which would leave no
    # mate-in-3 at all; the move count limit already keeps those short enough.
    if "veryLong" in themes:
        return True
    return "long" in themes and "mateIn3" not in themes


def convert_row(
    row: Mapping[str, str],
    config: FilterConfig = DEFAULT_FILTER,
    stats: Counter[str] | None = None,
) -> PuzzleEntry | None:
    """Filter and convert one Lichess CSV row; ``None`` if it is not kept.

    Cheap string checks run first; only survivors are replayed with python-chess.
    The rejection reason is counted in ``stats`` when given.
    """

    def reject(reason: str) -> None:
        if stats is not None:
            stats[reason] += 1

    try:
        puzzle_id = row["PuzzleId"].strip()
        fen = row["FEN"].strip()
        rating = int(row["Rating"])
        deviation = int(row["RatingDeviation"])
        popularity = int(row["Popularity"])
        plays = int(row["NbPlays"])
        moves = row["Moves"].split()
        themes = row["Themes"].split()
    except (KeyError, ValueError, AttributeError):
        reject("malformed")
        return None
    if not puzzle_id or not fen:
        reject("malformed")
        return None
    if deviation > config.max_rating_deviation:
        reject("rating_deviation")
        return None
    if popularity < config.min_popularity:
        reject("popularity")
        return None
    if plays < config.min_plays:
        reject("plays")
        return None
    if len(moves) > config.max_moves:
        reject("too_many_moves")
        return None
    theme_set = set(themes)
    if _is_too_long(theme_set):
        reject("long_theme")
        return None
    if not (theme_set & MATE_THEMES.keys() or theme_set & WIN_THEMES):
        reject("no_goal")
        return None
    # The setup move can capture at most one piece.
    rough_pieces = sum(char.isalpha() for char in fen.split(" ", 1)[0])
    if not config.min_pieces <= rough_pieces <= config.max_pieces + 1:
        reject("pieces")
        return None
    line = check_line(fen, moves)
    if line is None:
        reject("invalid_line")
        return None
    if not config.min_pieces <= line.pieces <= config.max_pieces:
        reject("pieces")
        return None
    goal = goal_for(theme_set, line)
    if goal is None:
        reject("goal_mismatch")
        return None
    if stats is not None:
        stats["kept"] += 1
    return PuzzleEntry(
        id=puzzle_id,
        fen=fen,
        moves=tuple(moves),
        rating=rating,
        themes=clean_themes(themes, goal),
        pieces=line.pieces,
        goal=goal,
    )


def iter_rows(handle: TextIO) -> Iterator[dict[str, str]]:
    """Yield CSV rows as dicts after checking the header."""
    reader = csv.reader(handle)
    header = next(reader, None)
    if header is None:
        msg = "the puzzle CSV is empty"
        raise SourceError(msg)
    missing = [column for column in REQUIRED_COLUMNS if column not in header]
    if missing:
        msg = f"the puzzle CSV lacks columns {missing}"
        raise SourceError(msg)
    for record in reader:
        if record:
            yield dict(zip(header, record, strict=False))


@contextmanager
def open_puzzle_csv(path: Path) -> Iterator[TextIO]:
    """Open a ``.csv`` or zstd-compressed ``.csv.zst`` file as streaming text."""
    raw = path.open("rb")
    text: TextIO
    try:
        if path.suffix == ".zst":
            # Lichess files may use long-distance matching: allow large windows.
            decompressor = zstandard.ZstdDecompressor(max_window_size=2**31)
            reader = decompressor.stream_reader(raw, closefd=False)
            text = io.TextIOWrapper(reader, encoding="utf-8", newline="")
        else:
            text = io.TextIOWrapper(raw, encoding="utf-8", newline="")
        try:
            yield text
        finally:
            text.close()
    finally:
        raw.close()


def download(url: str, destination: Path, *, timeout: float = 60.0) -> Path:
    """Stream ``url`` into ``destination`` (atomic rename once complete)."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "blindfold-chess-puzzle-builder/1.0"})
    LOG.info("downloading %s -> %s", url, destination)
    started = time.monotonic()
    with urllib.request.urlopen(request, timeout=timeout) as response, partial.open("wb") as out:
        shutil.copyfileobj(response, out, 1 << 20)
    partial.replace(destination)
    LOG.info(
        "downloaded %.1f MB in %.0fs",
        destination.stat().st_size / 1e6,
        time.monotonic() - started,
    )
    return destination


def resolve_source(input_path: Path | None, url: str, cache_dir: Path) -> Path:
    """Return a readable local copy of the database, downloading it if needed."""
    if input_path is not None:
        if not input_path.is_file():
            msg = f"input file not found: {input_path}"
            raise SourceError(msg)
        return input_path
    cached = cache_dir / url.rstrip("/").rsplit("/", 1)[-1]
    if cached.is_file() and cached.stat().st_size > 0:
        LOG.info("using cached %s", cached)
        return cached
    try:
        return download(url, cached)
    except (OSError, urllib.error.URLError) as exc:
        msg = f"cannot download {url}: {exc}"
        raise SourceError(msg) from exc


@dataclass(frozen=True, slots=True)
class BuildResult:
    backend: list[PuzzleEntry]
    candidates: int
    stats: Counter[str]


def build(
    source: Path,
    *,
    config: FilterConfig = DEFAULT_FILTER,
    seed: int = DEFAULT_SEED,
    total: int = DEFAULT_TOTAL,
    limit_rows: int | None = None,
) -> BuildResult:
    """Stream ``source`` and return a balanced, deterministic selection."""
    reservoir = StratifiedReservoir(seed=seed, per_cell=max(1000, total // 4))
    stats: Counter[str] = Counter()
    started = time.monotonic()
    try:
        with open_puzzle_csv(source) as handle:
            for index, row in enumerate(iter_rows(handle)):
                if limit_rows is not None and index >= limit_rows:
                    break
                stats["rows"] += 1
                entry = convert_row(row, config, stats)
                if entry is not None:
                    reservoir.add(entry)
                if stats["rows"] % 1_000_000 == 0:
                    LOG.info(
                        "%d rows, %d kept (%.0fs)",
                        stats["rows"],
                        stats["kept"],
                        time.monotonic() - started,
                    )
    except (OSError, UnicodeDecodeError, csv.Error, zstandard.ZstdError) as exc:
        msg = f"cannot read {source}: {exc}"
        raise SourceError(msg) from exc
    LOG.info("scanned %d rows in %.0fs", stats["rows"], time.monotonic() - started)
    return BuildResult(
        backend=reservoir.sample(total),
        candidates=sum(reservoir.counts.values()),
        stats=stats,
    )


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--input", type=Path, help="local lichess_db_puzzle.csv(.zst); skips the download")
    parser.add_argument("--url", default=LICHESS_URL, help="download URL (default: %(default)s)")
    parser.add_argument("--cache-dir", type=Path, default=CACHE_DIR, help="download cache directory")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="backend JSON file")
    parser.add_argument(
        "--frontend-output", type=Path, default=DEFAULT_FRONTEND_OUTPUT, help="frontend bundle"
    )
    parser.add_argument("--no-frontend", action="store_true", help="do not write the frontend bundle")
    parser.add_argument("--total", type=int, default=DEFAULT_TOTAL, help="backend puzzle count")
    parser.add_argument(
        "--frontend-total", type=int, default=DEFAULT_FRONTEND_TOTAL, help="frontend puzzle count"
    )
    parser.add_argument(
        "--frontend-max-kb",
        type=int,
        default=DEFAULT_FRONTEND_MAX_KB,
        help="shrink the frontend sample until the file fits (1 KB = 1000 bytes)",
    )
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="sampling seed")
    parser.add_argument("--max-rd", type=int, default=DEFAULT_FILTER.max_rating_deviation)
    parser.add_argument("--min-popularity", type=int, default=DEFAULT_FILTER.min_popularity)
    parser.add_argument("--min-plays", type=int, default=DEFAULT_FILTER.min_plays)
    parser.add_argument("--limit-rows", type=int, help="only scan the first N rows (debugging)")
    parser.add_argument("--generated", default=None, help="date stamp written to the files (default: today)")
    parser.add_argument("--no-fallback", action="store_true", help="fail instead of generating puzzles")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args(argv)


def _fallback(args: argparse.Namespace) -> int:
    import generate_puzzles  # noqa: PLC0415 - only needed when the database is unavailable

    forwarded = [
        "--output",
        str(args.output),
        "--seed",
        str(args.seed),
        "--frontend-max-kb",
        str(args.frontend_max_kb),
    ]
    if args.no_frontend:
        forwarded.append("--no-frontend")
    else:
        forwarded += ["--frontend-output", str(args.frontend_output)]
    if args.generated:
        forwarded += ["--generated", args.generated]
    return generate_puzzles.main(forwarded)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config = FilterConfig(
        max_rating_deviation=args.max_rd,
        min_popularity=args.min_popularity,
        min_plays=args.min_plays,
    )
    generated = args.generated or today()
    try:
        source = resolve_source(args.input, args.url, args.cache_dir)
        result = build(source, config=config, seed=args.seed, total=args.total, limit_rows=args.limit_rows)
    except SourceError as exc:
        if args.no_fallback:
            LOG.error("%s", exc)  # noqa: TRY400 - a traceback adds nothing here
            return 1
        LOG.warning("%s -- falling back to generate_puzzles.py", exc)
        return _fallback(args)
    if not result.backend:
        LOG.error("no puzzle passed the filters")
        return 1

    LOG.info("filter stats: %s", dict(sorted(result.stats.items())))
    LOG.info("verified candidates: %d", result.candidates)
    size = write_puzzle_file(args.output, result.backend, source=LICHESS_SOURCE, generated=generated)
    LOG.info("wrote %s (%.1f KB)\n%s", args.output, size / 1000, summarize(result.backend))
    if not args.no_frontend:
        subset = fit_sample(
            result.backend,
            args.frontend_total,
            args.seed,
            max_bytes=args.frontend_max_kb * 1000,
            source=LICHESS_SOURCE,
            generated=generated,
        )
        size = write_puzzle_file(args.frontend_output, subset, source=LICHESS_SOURCE, generated=generated)
        LOG.info("wrote %s (%.1f KB)\n%s", args.frontend_output, size / 1000, summarize(subset))
    return 0


if __name__ == "__main__":
    sys.exit(main())
