# Blindfold Chess API

Python backend of the free, open-source (GPL-3.0) blindfold chess trainer:

- **Puzzles**: 4000 short, low-material puzzles from the
  [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0),
  balanced across goals (mate in 1/2/3, winning tactic), piece counts and ratings.
- **Drills** without an engine: natural-looking move sequences, knight routes and
  positions to visualise, each with a spoken description.
- **Game analysis** with Stockfish: evaluations, win %, accuracy and move
  classifications. Without a Stockfish binary the endpoint answers 503 and the
  frontend analyses in the browser.

FastAPI + python-chess, Python 3.12, managed with [uv](https://docs.astral.sh/uv/).

## Quick start

```bash
cd backend
uv sync                                          # creates .venv with all dependency groups
uv run uvicorn app.main:app --reload --port 8000
# open http://localhost:8000/api/docs
```

Stockfish is optional. It is looked up via `STOCKFISH_PATH`, then `PATH`, then
`/usr/games/stockfish` and `/usr/bin/stockfish` (`apt install stockfish`,
`brew install stockfish`).

## Configuration

| Variable           | Default                  | Meaning                                                     |
|--------------------|--------------------------|-------------------------------------------------------------|
| `CORS_ORIGINS`     | `*`                      | Comma-separated allowed origins (no credentials, GET/POST)  |
| `PORT`             | `7860` (Docker image)    | Port uvicorn listens on in the container                    |
| `STOCKFISH_PATH`   | auto-discovery           | Stockfish binary                                            |
| `ENGINE_ENABLED`   | `true`                   | `false` disables analysis (always 503)                      |
| `ENGINE_POOL_SIZE` | `1`                      | Concurrent Stockfish processes                              |
| `ENGINE_THREADS`   | `1`                      | UCI `Threads` per process                                   |
| `ENGINE_HASH_MB`   | `32`                     | UCI `Hash` per process                                      |
| `ENGINE_MAX_TIME`  | `1.0`                    | Seconds cap per analysed position (`0` = depth only)        |
| `ENGINE_WAIT`      | `20`                     | Seconds to wait for a busy engine before answering 503      |
| `PUZZLES_PATH`     | `app/data/puzzles.json`  | Puzzle file to serve                                        |

## Development

```bash
uv run pytest -q                 # tests (Stockfish tests skip when no binary is found)
uv run ruff check .              # lint
uv run ruff format --check .     # formatting (drop --check to apply)
uv run mypy app scripts          # strict type checking
```

Layout: `app/main.py` (application factory), `app/routers/` (HTTP layer),
`app/services/` (domain logic without FastAPI), `app/data/puzzles.json`,
`scripts/` (puzzle pipeline), `tests/`.

## API

All routes live under `/api`; interactive docs at `/api/docs`, schema at
`/api/openapi.json`. Errors are JSON: `{"detail": "..."}` for 404/503 and
FastAPI's list of validation errors for 422. Every `seed` is an integer in
`0..2^53-1`; when omitted the server picks one and returns it.

### `GET /api/health`

```json
{"status": "ok", "version": "1.0.0", "engine": true, "puzzles": 4000}
```

`engine` is true when a Stockfish binary can be started.

### Puzzles

A puzzle follows the Lichess convention: `fen` is the position **before** the
opponent's setup move `moves[0]`; the solver then plays `moves[1]`, `moves[3]`, ...
and always makes the last move. `pieces` counts the pieces in the solver's position.

```json
{"id": "00sHx", "fen": "...", "moves": ["e8d7", "a2e6", "d7d8", "f7f8"],
 "rating": 1760, "themes": ["mateIn2", "endgame"], "pieces": 9, "goal": "mate2"}
```

| Route                       | Description                                                          |
|-----------------------------|----------------------------------------------------------------------|
| `GET /api/puzzles`          | `{"total": N, "items": [Puzzle]}`, easiest first or seeded shuffle   |
| `GET /api/puzzles/random`   | one `Puzzle`, 404 if nothing matches                                 |
| `GET /api/puzzles/meta`     | counts per goal and theme, rating and piece ranges                   |
| `GET /api/puzzles/{id}`     | one `Puzzle` or 404                                                  |

Filters (list and random): `goal` (`mate1`, `mate2`, `mate3`, `win`, `any`),
`min_rating`/`max_rating` (0-4000), `min_pieces`/`max_pieces` (2-32), `theme`
(case-insensitive). List only: `limit` (1-100, default 20), `offset`, `seed`
(stable shuffle across pages). Random only: `seed`, `exclude` (comma-separated ids).

### Drills

`GET /api/drills/sequence?plies=10&seed=123` (plies 2-40): a natural-looking
game from the initial position, never cut short by mate.

```json
{"seed": 123, "plies": 10, "san": ["Nc3", "Nc6", "e3", "d5", "..."],
 "uci": ["b1c3", "b8c6", "e2e3", "d7d5", "..."], "fen": "<final FEN>"}
```

`GET /api/drills/knight-route?seed=5&min_moves=2&max_moves=5`
(1 <= min <= max <= 6): the distance is drawn uniformly in the range, then a
square pair at that distance, then one of the shortest routes.

```json
{"seed": 5, "from": "a8", "to": "a2", "distance": 4,
 "path": ["a8", "b6", "d5", "b4", "a2"], "shortest_paths": 7}
```

`GET /api/drills/position?pieces=6&seed=1` (pieces 3-32): a puzzle position with
exactly that many pieces when one exists (4-16 with the bundled set), otherwise a
position from a simulated game (6+ pieces), otherwise a random legal position.

```json
{"seed": 1, "fen": "3k4/6R1/3K4/2P5/6p1/8/8/6r1 w - - 0 62", "pieces": 6,
 "description": "White: Kd6, Rg7, pawn c5. Black: Kd8, Rg1, pawn g4."}
```

Descriptions list K, Q, R, B, N then pawns, squares sorted by file then rank.

### `POST /api/analysis`

```json
{"moves": ["e2e4", "e7e5", "g1f3"], "initial_fen": null, "depth": 12}
```

UCI moves from the initial position (or `initial_fen`), at most 300 plies,
depth 6-18. Illegal moves or positions give 422; no usable engine gives
503 `{"detail": "engine unavailable"}`.

```json
{"engine": "Stockfish 16", "depth": 12,
 "initial": {"cp": 20, "mate": null, "win": 51.8, "best_uci": "e2e4", "best_san": "e4"},
 "plies": [{"ply": 1, "color": "w", "san": "e4", "uci": "e2e4", "cp": 30, "mate": null,
            "win": 52.7, "best_uci": "e2e4", "best_san": "e4", "drop": 0.0,
            "accuracy": 100.0, "classification": "best"}],
 "accuracy": {"white": 87.1, "black": 75.3},
 "counts": {"white": {"best": 3, "excellent": 5, "good": 2, "inaccuracy": 1, "mistake": 0, "blunder": 0},
            "black": {"best": 1, "excellent": 4, "good": 3, "inaccuracy": 2, "mistake": 1, "blunder": 0}}}
```

`cp`, `mate` and `win` describe the position **after** the ply from White's
point of view (`mate` > 0: White mates, < 0: Black mates, 0: the side to move
is mated); `best_*` is the engine's choice **before** the ply. Finished games
are scored without the engine (checkmate: win 100/0, stalemate or other
draws: cp 0). The formulas are in `app/services/accuracy.py`:

- `win(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`, cp clamped to ±1000
- `drop = max(0, win_before - win_after)` from the mover's point of view
- `accuracy = clamp(103.1668100711649 * exp(-0.04354415386753951 * drop) - 3.166924740191411, 0, 100)`
- `blunder` drop >= 15, `mistake` >= 10, `inaccuracy` >= 5, else `best` (engine
  move), `excellent` (drop < 2) or `good`
- side accuracy: mean of the arithmetic and harmonic means (harmonic over
  `max(accuracy, 1)`), `null` without moves

Values are computed unrounded and rounded to one decimal when serialised.

## Puzzle pipeline

`app/data/puzzles.json` and `../frontend/public/data/puzzles.json` are built by:

```bash
uv run python scripts/build_puzzles.py --input /path/to/lichess_db_puzzle.csv.zst
uv run python scripts/build_puzzles.py   # downloads into scripts/.cache/ (gitignored, ~300 MB)
```

It streams the zstd CSV (never loading it whole), keeps puzzles with rating
deviation <= 90, popularity >= 80, >= 200 plays, at most three solver moves,
3-16 pieces in the solver's position and a goal (`mateIn1/2/3` or
`crushing`/`advantage`), replays each with python-chess, then draws a seeded,
stratified sample (goal, piece bucket 3-6/7-9/10-12/13-16, rating bucket
<=1000/-1400/-1800/-2200/>2200). The frontend file is a balanced subset of the
backend file kept under 250 KB. `--help` lists the knobs (`--seed`, `--total`,
`--frontend-total`, thresholds, `--limit-rows`).

If the database cannot be read or downloaded, the script falls back to
`scripts/generate_puzzles.py`, which generates puzzles from random sparse
positions: screened by Stockfish when available (mates and single winning
moves), verified by a pure-Python mate search (`scripts/matesearch.py`), mates
only without an engine. It can also be run directly
(`uv run python scripts/generate_puzzles.py --no-engine --count 200`).

## Docker

```bash
docker build -t blindfold-chess-api backend
docker run --rm -p 7860:7860 -e CORS_ORIGINS="http://localhost:3000" blindfold-chess-api
```

The image (`python:3.12-slim`) installs Debian's `stockfish`
(`STOCKFISH_PATH=/usr/games/stockfish`), runs as uid 1000 and serves on
`${PORT:-7860}`.

## Deployment

### Render (free plan)

`render.yaml` at the repository root is a Blueprint for one free Docker web
service built from `backend/` with health check `/api/health`. In Render,
choose **New > Blueprint**, select the repository, and set `CORS_ORIGINS` to
the frontend origin(s). Free services sleep after 15 minutes without traffic;
the first request afterwards takes a while.

### Hugging Face Spaces

1. Create a Space with the **Docker** SDK (blank template).
2. Push the contents of `backend/` to the Space repository root.
3. Put this front matter at the top of the Space's `README.md`:

   ```yaml
   ---
   title: Blindfold Chess API
   colorFrom: gray
   colorTo: green
   sdk: docker
   app_port: 7860
   pinned: false
   license: gpl-3.0
   ---
   ```

4. Optionally add `CORS_ORIGINS` under **Settings > Variables and secrets**.

The API is then served at `https://<user>-<space>.hf.space/api/health`.

## License and data

Code: GPL-3.0. Puzzles: Lichess puzzle database, CC0 (attribution appreciated).
Stockfish is GPL-3.0 and runs as a separate process.
