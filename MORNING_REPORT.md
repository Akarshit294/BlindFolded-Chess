# Morning report

> **Update:** the interface has since been redesigned ("Studio": light and dark themes, 3D-rendered pieces, a
> melting board, a play-first flow). Every feature below still works; only the descriptions of the old look (the
> landing animation, the default piece set, the board themes) are out of date. See
> [`docs/design/REDESIGN_REPORT.md`](docs/design/REDESIGN_REPORT.md).

Good morning! The blindfold chess trainer is built, tested and ready for you to try. Everything is on the
branch `claude/blindfold-chess-training-tbzakt`, and the pull request to `main` is
[Akarshit294/BlindFolded-Chess#1](https://github.com/Akarshit294/BlindFolded-Chess/pull/1). CI is green.

## Run it (one command)

```bash
make dev
```

Then open **http://localhost:3000**. That installs everything on the first run (npm + uv) and starts the web
app and the API together; Ctrl-C stops both. I checked this from a fresh clone: both servers came up, the
engine loaded, and a game started against Stockfish with the API online.

- Needs Node 20.9+. The API also needs [uv](https://docs.astral.sh/uv/); without it, `make dev` runs the web
  app alone in offline mode (still fully playable).
- Stockfish on your machine is optional (`brew install stockfish` / `apt install stockfish`); it only speeds up
  game analysis. The in-browser engine is always there.
- Containers instead: `docker compose up --build` (both images build and run).

Try this first: **Play → Ghost → Lantern → Start**, type `e4`, then `knight to f3` and watch the pieces fade.
Then try **Total blindfold**, press **P** to peek, and resign to see the game review.

## What was built

| Area | Highlights |
|---|---|
| **Play** | Stockfish 19 WASM in a Web Worker (lite, single-threaded, lazy-loaded), 10 levels (Ember ~400 → Supernova), colour choice, five clock options. Five visibility modes: full, ghost, silhouette, empty board, total blindfold. Moves by typing (SAN/UCI/words, live validation + autocomplete), clicking hidden squares, or voice ("night f three", "castle long"), with spoken engine moves. Limited peeks, illegal-attempt counter, practice (takeback, hints) vs rated (Elo-style rating). All rules incl. threefold/50-move/insufficient material/flag fall; refresh restores the game. |
| **Game over** | Cinematic reveal (the mated king topples), confetti on wins, accuracy from engine analysis (server first, browser fallback), peeks, illegal attempts, time, rating change, and an animated replay with eval bar, eval graph and best/excellent/good/inaccuracy/mistake/blunder marks. |
| **Train** | Six drills, each with levels, a standard and a timed mode, instant feedback and an end screen with a per-drill rating: square colour, coordinates, knight routes, diagonals & lines, where's the piece (read or listen), memory. |
| **Puzzles** | 4,000 Lichess puzzles (CC0) filtered for blindfold play (3–16 pieces, ≤ 3 moves; 1,000 each of mate-in-1/2/3 and "winning move"); 1,200 ship with the frontend for offline use. Positions are given as text; hints, peeks, give-up, puzzle rating. |
| **Stats** | KPI tiles, rating chart with crosshair and table view, activity heatmap and streaks, per-drill sparklines, puzzle results by goal, recent games with replay; IndexedDB storage with JSON export/import. |
| **Pages** | Landing (the Opera Game dissolving into fog), Learn (visualisation guide, 4-week plan, fact-checked history), Settings (6 board themes incl. high contrast, 2 piece sets, sound, voice, motion), Credits, 404. |
| **Feel** | Spring piece movement, drag with lift/shadow/magnetic snap and spring-back, capture shatter, king-then-rook castling, en passant and promotion animations, check glow, fog, ghost trails, eye↔closed-eye morph, page transitions (View Transitions), animated numbers, skeletons, micro-interactions, synthesised Web Audio sounds with volume. Reduced motion respected (OS + in-app). |
| **Backend** | FastAPI + python-chess: puzzle API (filters, seeded random), drill generators (sequences, knight routes, positions) with seeds, game analysis with Stockfish (503 → browser fallback). Pipeline in `backend/scripts/`. pytest, ruff, mypy, Dockerfile, `render.yaml`, Hugging Face notes. |
| **Engineering** | Monorepo, `Makefile`, `docker-compose.yml`, GitHub Actions CI (lint, types, unit, build, Playwright e2e against both servers, Docker build + smoke test), DEPLOY.md, CREDITS.md, GPL-3.0. |

The original "Lumen" piece set, icons, sounds and visual design were made for this project; the classic
cburnett set is included with attribution.

## How I checked it

- **Unit tests:** 117 Vitest (frontend) + 267 pytest (backend), all passing.
- **End-to-end:** 43 Playwright tests (42 run without the API; CI runs all 43 with it) — a full game vs
  Stockfish in each visibility mode (typed and clicked moves), every drill answered correctly, puzzles,
  settings persistence, refresh restore, takeback/clock, import/export and replay, backend down and backend
  up, touch drag on a phone, no horizontal overflow at phone width.
- **CI:** green on the PR (frontend, backend, e2e, Docker).
- **Lighthouse** (mobile, throttled, median of three runs): accessibility, best practices and SEO 100 on
  landing, play, puzzles, train and stats; performance 91–95 on the first four and 86 on stats, whose content
  has to wait for your locally stored data.
- **Visual review:** I screenshotted every page and the key states (mid-drag, capture, peek, check,
  checkmate, game over) at 1440 px and on phones, fixed what looked wrong (see below), and kept the best
  ones in [`docs/screenshots/`](docs/screenshots/).

Bugs I found and fixed along the way: the board collapsed and the landing page overflowed at 390 px
(grid tracks sizing to content); starting a game from the long mobile setup screen left the board scrolled
out of view; inputs auto-focused on phones and popped the keyboard; a flipped checkerboard (a1 was light);
low-contrast muted text and coordinates; a slow LCP because headings waited for hydration; CI type-checking
needed Next's generated route types.

A final code review of the game, input, engine, puzzle and drill logic found 11 more bugs. All are fixed, most
with a test that fails on the old code. The ones you'd have hit:

- A spoken move, or a stale "Which one?" chip, could be played on the engine's turn and desync the game.
- An illegal move knocked focus out of the move box.
- In practice mode, Enter could turn a complete but illegal move into a different legal one.
- `bxc4` was read as a bishop move.
- A reload gave back the time already spent on the current move.
- The engine didn't know the game's history, so it couldn't avoid repetitions.

The full list is in [DECISIONS.md](DECISIONS.md#code-review-pass). The Stats page also got faster: Lighthouse
performance went from 74 to 86, after it stopped loading every drill and the replay board up front.

## Known limitations

- **Voice input** relies on the browser's Web Speech API: Chrome, Edge and Safari yes; Firefox no (the mic
  button simply doesn't appear).
- **Ratings are local and approximate.** Engine Elo labels are estimates (the lite network is weaker than full
  Stockfish but still superhuman); the blindfold/puzzle/drill ratings are motivating numbers, not official ones.
- **Time away from a game doesn't count:** navigating away or refreshing pauses your clock. Time already
  spent on the move still counts, but a determined player could step away to think for free.
- **Page transitions** use the View Transitions API, so browsers without it just navigate without the fade.
- **Free-tier API cold starts** take 30–60 s; the site works offline meanwhile and switches over when the API
  wakes.

## Ideas for next steps

1. **Blindfold simul** — two (or more) games at once, the classic blindfold feat.
2. **Adaptive drills** — spaced repetition that brings back the squares, routes and positions you miss.
3. **Opening trainer** — play your repertoire from memory with the board hidden.
4. **Installable PWA** — cache the engine and puzzles for fully offline use on phones.
5. **Offline speech recognition** (e.g. Vosk WASM) for Firefox and privacy.
6. **Daily puzzle and shareable results** (no accounts, just a link).
7. **Calibrate the low levels** against real games so "≈700" really means 700.

## Where to look

- [README.md](README.md) — overview, screenshots, quick start, architecture
- [DEPLOY.md](DEPLOY.md) — Vercel + Render/Hugging Face, step by step, $0
- [DECISIONS.md](DECISIONS.md) — every judgement call (including how I read the parts of the brief that were cut off)
- [PLAN.md](PLAN.md) — the checklist, ticked
- [CREDITS.md](CREDITS.md) — all third-party licences
