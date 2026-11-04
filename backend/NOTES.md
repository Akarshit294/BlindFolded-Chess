# Backend decisions

Short notes to copy into the repository's DECISIONS.md.

## Puzzle data

- **`long` theme vs mate in 3**: Lichess tags every puzzle with three solver moves
  as `long`, so excluding `long` would leave no mate-in-3 at all. We exclude
  `veryLong` always and `long` unless the puzzle is `mateIn3`; `len(Moves) <= 6`
  still caps the solver at three moves (in practice `win` puzzles have at most two).
- **Thresholds kept as specified** (RD <= 90, popularity >= 80, plays >= 200,
  3-16 pieces in the solver's position): 6,193,530 rows give 716,508 verified
  candidates, so no tuning was needed. A full run takes about 2 minutes.
- **Goals come from the board**: every line is replayed; `mateN` needs checkmate
  after exactly N solver moves and matching `mateInN` tags; non-mates need
  `crushing` or `advantage` to be `win`.
- **Themes dropped**: `mate`, `short`, `long`, `veryLong`, `oneMove`, `master`,
  `masterVs*`, `superGM`. `mateInN` stays on mate puzzles.
- **Sampling**: order-independent hash ranking (`blake2b(seed:id)`), seed 2026,
  water-filling over goals first (1000 each), then 20 piece x rating cells.
  Rating buckets: <=1000, 1001-1400, 1401-1800, 1801-2200, >2200. Mates rated
  above 2200 are rare, so that bucket holds 516 puzzles instead of ~880.
- **Frontend bundle**: 1200 puzzles (300 per goal), a strict subset of the backend
  file, 229 KB compact JSON (auto-shrunk if it ever exceeds 245,000 bytes).
- **File order** is (rating, id), so an unseeded `GET /api/puzzles` lists the
  easiest puzzles first.
- **Mate answers**: files store one line; the UI should accept any checkmating
  move on the final solver move (Lichess convention).
- **Fallback generator** (`scripts/generate_puzzles.py`): ids `g` + 8 hex chars,
  estimated ratings, 400 puzzles / 10 minute budget by default; without Stockfish
  it produces mate goals only. Mates are always verified by the pure-Python
  search, because Stockfish 16 at depth 20 misses Morphy's 1.Ra6 mate in 2.

## API

- Contract implemented as specified. Additions: `GET /` (JSON pointer to the docs,
  outside `/api`, hidden from the schema), docs at `/api/docs`, schema at
  `/api/openapi.json`.
- **Errors**: 404 and 503 are `{"detail": "..."}`; every 422 uses FastAPI's
  list format, including cross-field checks (`min_rating > max_rating`,
  `min_moves > max_moves`) and illegal analysis moves (`loc` =
  `["body", "moves", index]`).
- **Bounds**: ratings 0-4000, puzzle piece filters 2-32, offset <= 1,000,000,
  `theme` alphanumeric (max 40, case-insensitive), `exclude` <= 20,000 chars,
  seeds 0..2^53-1 (JavaScript safe integers). Omitted seeds are drawn from
  [0, 2^31) and echoed back. `/api/drills/position` defaults to 6 pieces.
- **Determinism**: list shuffles, random picks and all drills are reproducible
  for a seed (with the same code and data). The sequence drill sorts legal moves
  by UCI before sampling, so it does not depend on move-generation order.
- **Sequence drill**: a weighted heuristic policy (no engine). It never plays a
  move that ends the game, the last ply included.
- **Knight route**: the distance is drawn uniformly in `[min, max]`, then a square
  pair at that distance, then one of the shortest paths uniformly.
- **Position drill**: a puzzle's solver position with that piece count (3-16), else
  a simulated natural game that trades down to the count (17-32, and 3), else a
  random legal position from the standard material set. No `source` field.
- **Analysis engine**: a lazily started pool (`ENGINE_POOL_SIZE=1`, Threads 1,
  Hash 32, `ucinewgame` per request). Each position is also capped at
  `ENGINE_MAX_TIME=1.0` s for slow free-tier CPUs. A missing binary, a crash, or
  waiting more than `ENGINE_WAIT=20` s for a busy engine all return the same 503
  `{"detail":"engine unavailable"}`.
- **Analysis values**: `mate: 0` means the side to move is checkmated (`win` says
  who won). Draws by rule (insufficient material, 75 moves, fivefold) score
  cp 0 but still get an engine best move. Values are computed unrounded;
  `win`/`drop`/`accuracy` are rounded with Python `round(x, 1)` only in the
  response, and classification uses the unrounded drop. Input UCI is
  case-insensitive; the response echoes normalised UCI.
- **Health** `engine` means "a Stockfish process could be started" (cached;
  a failed probe is retried after 60 s).

## Tooling and deployment

- `httpx2` replaces `httpx` in the dev group: Starlette 1.10's TestClient imports
  `httpx2` and deprecates `httpx`, and pytest runs with warnings as errors.
- uv virtual project (`package = false`); `zstandard` lives in the dev group (the
  pipeline is a dev tool and is not in the Docker image). License metadata says
  `GPL-3.0-or-later`; change it if the repository uses GPL-3.0-only.
- **Docker**: `python:3.12-slim` (Debian trixie, `stockfish` 17-1, reports
  "Stockfish 17.1"), uv pinned via `ghcr.io/astral-sh/uv:0.11.32`, venv in
  `/opt/venv`, uid 1000, uvicorn with `--proxy-headers`. Verified locally: built
  and ran the image (health, analysis, CORS) with a manually started dockerd;
  472 MB on disk, 148 MB compressed.
- **Render**: `rootDir: backend`, so `dockerfilePath: ./Dockerfile` and
  `dockerContext: .` are relative to `backend/` (Render's monorepo docs).
  `CORS_ORIGINS` defaults to `*`; set it to the frontend origin. Free instances
  sleep after 15 idle minutes, so the frontend should time out and fall back to
  local analysis and puzzles.
