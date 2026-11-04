# PLAN — Blindfold Chess Trainer

Build order: vertical slices. A playable blindfold game first, then drills, then backend + puzzles,
then stats, then polish. Every item below comes from the original brief; tick it when done.

Legend: `[x]` done · `[ ]` open · `[~]` done with a documented deviation (see DECISIONS.md)

---

## M0 — Foundations
- [x] Repo skeleton, GPL-3.0 LICENSE, `.gitignore`
- [x] PLAN.md (this file) and DECISIONS.md
- [ ] Frontend scaffold: Next.js (App Router) + TypeScript strict + Tailwind CSS + Motion
- [ ] Backend scaffold: Python 3.12 + FastAPI + python-chess, managed with uv
- [ ] Root `Makefile` (`make dev`, `make test`, `make lint`) and `docker-compose.yml`
- [ ] One command runs everything locally (`make dev`)

## M1 — Play vs computer, blindfolded (first vertical slice)
### Engine
- [ ] Stockfish WASM in a Web Worker, single-threaded lite build (no COOP/COEP), lazy-loaded
- [ ] 8+ difficulty levels (Skill Level / UCI_LimitStrength + UCI_Elo; softmax sampling for the lowest)
- [ ] Choose colour (white / black / random)
- [ ] Optional clock (several time controls, increment, flag fall)
### Visibility modes
- [ ] Full board (warm-up)
- [ ] Ghost: pieces fade out a few seconds after each move
- [ ] Silhouette: occupied squares visible, not which piece
- [ ] Empty board: coordinates only, last move flashes briefly
- [ ] Total blindfold: no board at all, only moves as text / voice
### Move input
- [ ] Type SAN or UCI with live validation and autocomplete
- [ ] Click from/to squares on the hidden board
- [ ] Voice input (Web Speech API): "e4", "castle kingside", "bishop takes c6", "knight f three"…
- [ ] Voice output (speechSynthesis) announces moves; everything optional
### Blindfold mechanics
- [ ] Limited peeks (reveal the board with a lifting animation), counted
- [ ] Illegal-move attempts tracked
- [ ] Practice mode with takeback; rated mode (no takeback, rating changes)
### Game over
- [ ] Cinematic board reveal, result
- [ ] Stats: engine-based accuracy, peeks used, illegal attempts, time
- [ ] Animated replay with eval bar and move classification (best … blunder)
### Rules
- [ ] Castling, en passant, promotion, check, checkmate, stalemate
- [ ] Threefold repetition, 50-move rule, insufficient material
- [ ] Resign, draw offer/claim, flag fall
- [ ] Refreshing the page restores the game in progress

## M2 — Training drills (levels, timed mode, instant feedback, end screen)
- [ ] Drill hub (Train page)
- [ ] Square colour ("What colour is g5?")
- [ ] Coordinates (name the highlighted square / find the named square on an unlabeled board)
- [ ] Knight routes (shortest knight path, typed as squares)
- [ ] Diagonals and lines (shared diagonals/ranks/files, squares between)
- [ ] Where's the piece? (move sequence as text, optionally read aloud; then questions)
- [ ] Memory (position shown for N seconds, rebuild it by placing pieces)
- [ ] Blindfold puzzles (position only as text, mate in 1/2/3 or winning move, SAN answers)

## M3 — Backend + puzzles
- [ ] Puzzle pipeline in `backend/scripts/` (Lichess CC0 DB → few thousand blindfold-friendly puzzles)
- [ ] Fallback generator (Stockfish binary, else pure-Python mate search) if the download is blocked
- [ ] Compact JSON committed (backend full set + frontend bundled fallback subset)
- [ ] Puzzle API (filter by rating / theme / goal / piece count, random with seed)
- [ ] Drill generator endpoints (move sequences, knight routes, positions) with seeds
- [ ] Game analysis endpoint (python-chess + Stockfish binary when present)
- [ ] pytest, ruff, mypy, Dockerfile
- [ ] Frontend never breaks when the backend is down: bundled JSON + client-side generation/analysis + status indicator
- [ ] Puzzles page

## M4 — Progress
- [ ] Stats dashboard: charts per drill, streaks, accuracy over time, rating-ish scores
- [ ] Stored locally (IndexedDB with localStorage fallback)
- [ ] Export / import progress (JSON)

## M5 — Pages and feel
- [ ] Landing page: animated, interactive board that dissolves into fog
- [ ] Learn page: visualisation guide, training plan, accurate short history of blindfold chess
- [ ] Settings page: board theme, piece set, sound, volume, voice, reduced motion, defaults
- [ ] Credits page (+ CREDITS.md listing every third-party licence)
- [ ] Original SVG piece set + cburnett (CC BY-SA 3.0, attributed)
- [ ] Several board themes incl. high contrast
### Animation (top priority)
- [ ] 60 fps, transforms/opacity only
- [ ] Spring-physics piece movement
- [ ] Drag with lift, scale, shadow and magnetic snap; spring back on illegal drop
- [ ] Captured piece shatters/dissolves
- [ ] Castling choreography (king, then rook)
- [ ] Elegant promotion picker
- [ ] En passant handled visually
- [ ] Check: king square glow pulse
- [ ] Checkmate: dramatic final move, then reveal
- [ ] Win: lightweight canvas confetti
- [ ] Fog/dissolve when pieces vanish; blindfold lift on peek; ghost trail for last move
- [ ] Blindfold/eye icon morph when switching modes
- [ ] Arrows and highlights draw in smoothly; eval bar springs
- [ ] Animated counting numbers on stats; page transitions; staggered list entrances
- [ ] Micro-interactions on buttons; skeleton loaders
- [ ] Web Audio synthesized sounds (move, capture, check, castle, illegal, game end, correct, wrong…) + volume
- [ ] prefers-reduced-motion respected + in-app setting
- [ ] Mobile-first, responsive, touch drag
- [ ] Keyboard accessible; ARIA live region announces moves

## M6 — Engineering
- [ ] Vitest: SAN parsing, voice normalisation, drill generators, scoring/rating, storage
- [ ] Playwright: full game vs engine in each visibility mode, each drill, settings persistence, backend-down fallback
- [ ] GitHub Actions CI (lint, typecheck, test, build — both apps)
- [ ] `next build` with zero type errors; lean bundle
- [ ] Deploy-ready: `render.yaml` (free), Hugging Face Spaces Dockerfile, `NEXT_PUBLIC_API_URL`, DEPLOY.md

## M7 — Verify and polish
- [ ] Screenshots of every page and key states (mid-drag, capture, peek, check, game over) at 1440px and 390px
- [ ] Polish pass A — visual design and animation
- [ ] Polish pass B — UX and edge cases
- [ ] Polish pass C — code quality, tests, accessibility, performance
- [ ] Best screenshots in `docs/screenshots/`

## M8 — Wrap-up
- [ ] README.md (what it is, screenshots, quickstart, architecture)
- [ ] MORNING_REPORT.md
- [ ] Push branch, open PR to `main`
