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
