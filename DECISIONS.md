# DECISIONS

Choices made while building this overnight without being able to ask. Newest decisions are appended at the bottom
of each section.

## Interpreting the brief
- Parts of the original brief arrived truncated mid-line (e.g. "Total blindfold: no board at all, oe",
  "Practice mode with takeback; rated mo"). I filled the gaps with the most natural reading and listed the
  interpretations here:
  - *Total blindfold*: no board at all — only the move list as text plus optional voice.
  - *Silhouette*: you see which squares are occupied, but not which piece (or whose) stands there.
  - *Peeks*: reveal the board for a few seconds with a lifting animation; the count is limited per game.
  - *Rated mode*: no takeback, no live move validation, limited peeks, and the result moves your local
    blindfold rating. *Practice mode*: takeback allowed, autocomplete on.
  - *Rules*: castling, en passant, promotion, check, checkmate, stalemate, threefold, 50-move, insufficient
    material, resign, draw; refreshing the page restores the game in progress.
  - *Drills*: each has levels, a timed mode, instant feedback and an end screen.
  - *Blindfold puzzles*: the position is given only as text ("White: Kg1, Qd1 … Black: …").
  - *Stats*: charts per drill, streaks, accuracy over time and a rating-like score.
  - *Pages*: Settings (board theme, piece set, sound, voice, reduced motion) was implied by the cut-off list.
  - *Backend down*: show a small status indicator ("offline mode") and fall back silently.
  - *Screenshots*: 1440px desktop and 390px mobile.
  - *Polish passes*: three, as listed in the brief.

## Toolchain
- **TypeScript 6.0.x, not 7.0.** TypeScript 7 (the native Go port) is "latest" on npm, and Next 16.4 can type-check
  with it, but `typescript-eslint` (used by `eslint-config-next`) only supports `<6.1.0`. TS 6.0 is the newest
  release that works with the whole toolchain.
- **ESLint 9** (as chosen by `create-next-app@16.4.5`) rather than ESLint 10, because the Next ESLint plugins pin to it.
- **Playwright**: the project uses `@playwright/test` latest. In this sandbox the browser is pre-installed for a
  slightly older Playwright, so the config honours `PW_CHROMIUM_PATH` to point at it. In CI the matching browser is
  installed with `npx playwright install --with-deps chromium`.
- **Stockfish build**: `stockfish@19` npm package (nmrugg/stockfish.js, GPL-3.0), the *lite single-threaded* flavour
  (~1.9 MB wasm). It needs no cross-origin isolation headers, so it runs on any static host incl. Vercel Hobby.
  The files are copied from `node_modules` into `public/engine/` by a `predev`/`prebuild` script (not committed).
- **Fonts** are self-hosted from `@fontsource-variable/*` packages (OFL) so builds never need network access to
  Google Fonts.
- `cacheComponents` (Next 16 default from create-next-app) is kept on. It means routes are kept alive (hidden) on
  navigation; all long-lived side effects (engine worker, clocks, listeners) live in effects that clean up properly.
- **React Compiler lint rules** (`eslint-plugin-react-hooks` v6 via `eslint-config-next` 16) are kept at their
  defaults. Instead of disabling them, code uses render-phase derived state (board piece identities, selection
  reset), timer callbacks for transitions, `useSyncExternalStore` for browser-only values, and refs written in
  layout effects.
- **Docker for the frontend** is optional (`docker compose up`); it uses Next's `standalone` output, enabled only
  when `NEXT_OUTPUT=standalone`, so Vercel builds are unaffected.

## Product
- **Brand**: "Blindfold." with an eye that closes (lids meet, lashes drop) — the eye↔closed-eye morph used for
  mode switches. Dark "midnight + candlelight" palette: ivory text, ember (amber) for primary actions,
  moon (lavender) for the mind's-eye/fog elements. The site is dark-only; six board themes (incl. high contrast)
  give the colour choice where it matters.
- **Engine levels**: ten named levels (Ember 400 → Supernova full strength). Levels 1–4 sample Stockfish's MultiPV
  lines with a softmax temperature and an occasional deliberate slip, because even Skill Level 0 is far too strong
  for beginners; levels 5–9 use `UCI_LimitStrength` + `UCI_Elo` (1400–2600); level 10 is unrestricted.
  Elo labels are approximate.
- **Visibility modes**: Full, Ghost (pieces fade `ghostDelay` seconds after each move, then fog), Silhouette
  (neutral glowing tokens on occupied squares — no colour, no type), Empty board (all coordinates printed, last
  move flashes), Total blindfold (no board; a "mind's eye" stage shows the last move). Check highlights and legal
  move dots are only shown when the pieces are visible, so they never leak information.
- **Clicking on a hidden board** selects any square (we never reveal whether a piece is there); the second click
  attempts the move and an illegal attempt is counted.
- **Rated mode** is disabled for the full-board warm-up. It forbids takebacks, turns move hints off (syntax-only
  checking, so legality can't be probed) and caps peeks at 3. The blindfold rating is Elo-like (K 40 for the first
  10 games, then 24) against the level's nominal Elo.
- **Draw offers**: the engine accepts when it is worse by ≥0.6 pawns, or when the game is level (≤0.35) after
  move 15. Offers are limited to one per 10 plies. Threefold repetition, the 50-move rule and insufficient
  material end the game automatically (no claim needed); flag fall is a loss unless the opponent cannot mate.
- **Refresh restore**: the game in progress lives in localStorage (`bf:game`) and is restored on reload; the time
  spent away does not count against the clock.
- **Accuracy**: Lichess-style win% from centipawns, accuracy per move from the win% drop, side accuracy as the
  mean of the arithmetic and harmonic means. Classes: best / excellent (<2) / good / inaccuracy (≥5) / mistake
  (≥10) / blunder (≥15 win% points). The same formulas are implemented in TypeScript and Python. Analysis tries
  the backend first and falls back to the browser engine (≈220 ms/position, depth ≤ 12).
- **Puzzles**: shown as text ("White: Kg1, Qd1, pawns f2 g2. Black: …"). By default the opponent's setup move is
  already applied and named; a "harder" toggle shows the position *before* it so you apply it yourself. Any
  checkmate is accepted on the final move. Puzzle rating: Elo vs the puzzle rating; a clean solve scores 1, a
  clean solve after peeking 0.5, anything with mistakes/hints/give-up 0.
- **Drill ratings** treat each session as a game against a level difficulty (800–2000) with accuracy as the score.
- **Where's the piece?** asks three questions per game fragment (what's on a square, where is a piece, is a move
  legal). Sequences come from the API when online, otherwise from an equivalent local generator with the same
  seed (the two generators are not bit-identical — the seed just makes each side reproducible).
- **Memory positions** come from real puzzle positions when the API is online, otherwise from a random legal
  position generator.
- **Voice**: Web Speech API recognition with up to five alternatives; each is normalised ("night"→knight,
  "bee"→b, "to" after a file → 2, …) and the first legal interpretation wins. Spoken promotions default to a
  queen. Speech synthesis reads the engine's moves (optionally yours). Both are optional and feature-detected.
- **Stats** are local only (IndexedDB, localStorage fallback) with JSON export/import (merge or replace).
  Chart colours were validated with the dataviz palette checker for the dark surface: moon-500 `#7a85df`,
  ember-600 `#c4731b`, jade-600 `#1f8f67`.
- **Page transitions** use React's `<ViewTransition>` (supported in Chromium, Safari, recent Firefox); other
  browsers just navigate without the cross-fade.
- **History facts** on the Learn page were checked against Wikipedia's "Blindfold chess" article; where sources
  disagree (Alekhine's Chicago exhibition is dated 1933 or 1934) the text stays deliberately general.

## Backend (from `backend/NOTES.md`)
- Puzzle filter: RD ≤ 90, popularity ≥ 80, plays ≥ 200, 3–16 pieces in the solver's position, ≤ 3 solver moves.
  `veryLong` is always excluded; `long` is excluded except for mate-in-3 (Lichess tags every 3-move puzzle `long`).
  6.19 M rows → 716,508 verified candidates → 4,000 stratified puzzles (1,000 per goal; piece and rating buckets),
  and a 1,200-puzzle (300 per goal, 229 KB) subset bundled with the frontend.
- A fallback generator (`backend/scripts/generate_puzzles.py`) can create puzzles with Stockfish or a pure-Python
  mate search if the Lichess download is ever unavailable; it was not needed.
- 422 errors use FastAPI's list format; 404/503 use `{"detail": …}`. `/api/analysis` returns 503 when the engine
  is missing, crashed or busy for > 20 s, and caps each position at 1 s for slow free-tier CPUs.
- `httpx2` is the test client dependency (Starlette 1.10's TestClient moved to it).

## Polish passes
- **Mobile**: every responsive grid has an explicit `grid-cols-1` base with `minmax(0, …)` tracks — without it the
  board's `aspect-square` collapsed to zero width and the landing page overflowed at 390 px. Covered by e2e
  "no horizontal overflow" tests and a CDP-driven touch-drag test.
- **Autofocus** of text inputs happens only on devices with a fine pointer, and never scrolls; on phones it
  popped the keyboard and pushed the page under the sticky header.
- **Clock and navigation**: leaving the Play page (or refreshing) pauses the clock; time away is not counted.
- **Contrast**: muted text `ivory-500` was raised to `#8f897d` (≥ 4.9:1 on every surface). Board coordinates
  use darker text on light squares and deep text on mid-tone dark squares so every theme passes 4.5:1;
  Nocturne's dark square moved from `#6f7a96` to `#69748f` for white coordinates.
- **LCP**: page headers animate with CSS (`.rise-in`, starting at 30 % opacity) instead of Motion, so they paint
  before hydration; client-only pages (Play, Stats) render their headers while their data loads.
- **Lighthouse** (mobile, simulated throttling) after the passes: accessibility, best practices and SEO 100 on
  landing, play, puzzles, train and stats; performance 90–93 on landing/play/puzzles/train.
- **Bundle**: ~230 KB gzipped JS is shared (React/Next ≈ 165 KB, Motion ≈ 47 KB); routes add 5–65 KB. The
  1.9 MB engine (wasm) loads only when a game or analysis starts. Converting Motion to `LazyMotion` would save
  roughly 15–20 KB but touches every animated component, so it was left for later.
- **Docker**: the backend image is built and smoke-tested in CI; the frontend image (Next standalone) was built
  and run locally. `docker compose up` itself was not run end-to-end in the sandbox.
- **`/lab`** is a development-only page for exercising board animations (capture, castling, en passant,
  promotion, check, mate, ghost); production builds return 404 for it.
