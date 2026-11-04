# PLAN — Blindfold Chess Trainer

Build order: vertical slices. A playable blindfold game first, then drills, then backend + puzzles,
then stats, then polish. Every item below comes from the original brief; tick it when done.

Legend: `[x]` done · `[ ]` open · `[~]` done with a documented deviation (see DECISIONS.md)

---

## M0 — Foundations
- [x] Repo skeleton, GPL-3.0 LICENSE, `.gitignore`
- [x] PLAN.md (this file) and DECISIONS.md
- [x] Frontend scaffold: Next.js (App Router) + TypeScript strict + Tailwind CSS + Motion
- [x] Backend scaffold: Python 3.12 + FastAPI + python-chess, managed with uv
- [x] Root `Makefile` (`make dev`, `make test`, `make lint`) and `docker-compose.yml`
- [x] One command runs everything locally (`make dev`)

## M1 — Play vs computer, blindfolded (first vertical slice)
### Engine
- [x] Stockfish WASM in a Web Worker, single-threaded lite build (no COOP/COEP), lazy-loaded
- [x] 8+ difficulty levels (Skill Level / UCI_LimitStrength + UCI_Elo; softmax sampling for the lowest)
- [x] Choose colour (white / black / random)
- [x] Optional clock (several time controls, increment, flag fall)
### Visibility modes
- [x] Full board (warm-up)
- [x] Ghost: pieces fade out a few seconds after each move
- [x] Silhouette: occupied squares visible, not which piece
- [x] Empty board: coordinates only, last move flashes briefly
- [x] Total blindfold: no board at all, only moves as text / voice
### Move input
- [x] Type SAN or UCI with live validation and autocomplete
- [x] Click from/to squares on the hidden board
- [x] Voice input (Web Speech API): "e4", "castle kingside", "bishop takes c6", "knight f three"…
- [x] Voice output (speechSynthesis) announces moves; everything optional
### Blindfold mechanics
- [x] Limited peeks (reveal the board with a lifting animation), counted
- [x] Illegal-move attempts tracked
- [x] Practice mode with takeback; rated mode (no takeback, rating changes)
### Game over
- [x] Cinematic board reveal, result
- [x] Stats: engine-based accuracy, peeks used, illegal attempts, time
- [x] Animated replay with eval bar and move classification (best … blunder)
### Rules
- [x] Castling, en passant, promotion, check, checkmate, stalemate
- [x] Threefold repetition, 50-move rule, insufficient material
- [x] Resign, draw offer/claim, flag fall
- [x] Refreshing the page restores the game in progress

## M2 — Training drills (levels, timed mode, instant feedback, end screen)
- [x] Drill hub (Train page)
- [x] Square colour ("What colour is g5?")
- [x] Coordinates (name the highlighted square / find the named square on an unlabeled board)
- [x] Knight routes (shortest knight path, typed as squares)
- [x] Diagonals and lines (shared diagonals/ranks/files, squares between)
- [x] Where's the piece? (move sequence as text, optionally read aloud; then questions)
- [x] Memory (position shown for N seconds, rebuild it by placing pieces)
- [x] Blindfold puzzles (position only as text, mate in 1/2/3 or winning move, SAN answers)

## M3 — Backend + puzzles
- [x] Puzzle pipeline in `backend/scripts/` (Lichess CC0 DB → few thousand blindfold-friendly puzzles)
- [x] Fallback generator (Stockfish binary, else pure-Python mate search) if the download is blocked
- [x] Compact JSON committed (backend full set + frontend bundled fallback subset)
- [x] Puzzle API (filter by rating / theme / goal / piece count, random with seed)
- [x] Drill generator endpoints (move sequences, knight routes, positions) with seeds
- [x] Game analysis endpoint (python-chess + Stockfish binary when present)
- [x] pytest, ruff, mypy, Dockerfile
- [x] Frontend never breaks when the backend is down: bundled JSON + client-side generation/analysis + status indicator
- [x] Puzzles page

## M4 — Progress
- [x] Stats dashboard: charts per drill, streaks, accuracy over time, rating-ish scores
- [x] Stored locally (IndexedDB with localStorage fallback)
- [x] Export / import progress (JSON)

## M5 — Pages and feel
- [x] Landing page: animated, interactive board that dissolves into fog
- [x] Learn page: visualisation guide, training plan, accurate short history of blindfold chess
- [x] Settings page: board theme, piece set, sound, volume, voice, reduced motion, defaults
- [x] Credits page (+ CREDITS.md listing every third-party licence)
- [x] Original SVG piece set + cburnett (CC BY-SA 3.0, attributed)
- [x] Several board themes incl. high contrast
### Animation (top priority)
- [x] 60 fps, transforms/opacity only
- [x] Spring-physics piece movement
- [x] Drag with lift, scale, shadow and magnetic snap; spring back on illegal drop
- [x] Captured piece shatters/dissolves
- [x] Castling choreography (king, then rook)
- [x] Elegant promotion picker
- [x] En passant handled visually
- [x] Check: king square glow pulse
- [x] Checkmate: dramatic final move, then reveal
- [x] Win: lightweight canvas confetti
- [x] Fog/dissolve when pieces vanish; blindfold lift on peek; ghost trail for last move
- [x] Blindfold/eye icon morph when switching modes
- [x] Arrows and highlights draw in smoothly; eval bar springs
- [x] Animated counting numbers on stats; page transitions; staggered list entrances
- [x] Micro-interactions on buttons; skeleton loaders
- [x] Web Audio synthesized sounds (move, capture, check, castle, illegal, game end, correct, wrong…) + volume
- [x] prefers-reduced-motion respected + in-app setting
- [x] Mobile-first, responsive, touch drag
- [x] Keyboard accessible; ARIA live region announces moves

## M6 — Engineering
- [x] Vitest: SAN parsing, voice normalisation, drill generators, scoring/rating, storage
- [x] Playwright: full game vs engine in each visibility mode, each drill, settings persistence, backend-down fallback
- [x] GitHub Actions CI (lint, typecheck, test, build — both apps)
- [x] `next build` with zero type errors; lean bundle
- [x] Deploy-ready: `render.yaml` (free), Hugging Face Spaces Dockerfile, `NEXT_PUBLIC_API_URL`, DEPLOY.md

## M7 — Verify and polish
- [x] Screenshots of every page and key states (mid-drag, capture, peek, check, game over) at 1440px and 390px
- [x] Polish pass A — visual design and animation
- [x] Polish pass B — UX and edge cases
- [x] Polish pass C — code quality, tests, accessibility, performance
- [x] Best screenshots in `docs/screenshots/`

## M8 — Wrap-up
- [x] README.md (what it is, screenshots, quickstart, architecture)
- [x] MORNING_REPORT.md
- [ ] Push branch, open PR to `main`
