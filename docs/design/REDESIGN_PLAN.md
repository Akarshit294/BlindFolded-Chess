# Redesign plan: Blindfold Chess, "Studio"

The working name for the new look is **Studio**: a monochrome photo studio, frosted glass, glossy pieces, and a
checkerboard that melts when the pieces hide. This file is the plan and the checklist. Decisions and their reasons
are logged in [`DECISIONS.md`](DECISIONS.md); the final write-up is [`REDESIGN_REPORT.md`](REDESIGN_REPORT.md).

## 1. Principles

1. **Monochrome first.** White, light grays, charcoal, black. Color appears only when it means something
   (check, right/wrong, move quality, rating deltas), and then desaturated.
2. **One stage.** Every page sits on a single frosted-glass stage floating over a studio backdrop. Inside it,
   hierarchy comes from type, spacing and glass depth, not from boxes in boxes.
3. **The board is the hero.** Glossy porcelain and lacquer pieces. When pieces hide, the board ripples and melts;
   a peek makes it solid again. The melt is the blindfold.
4. **Play in one click.** No setup screen. Defaults are good, changes are optional and remembered.
5. **Show, don't tell.** Motion and live demos explain the modes; copy stays short.
6. **Readable gray.** Every gray-on-gray pair is checked; body text ≥ 4.5:1, display thin text ≥ 3:1 at ≥ 24 px.
7. **Calm motion.** One orchestrated moment per view, motion that answers the user, springs for objects,
   nothing that blocks input, all of it off with reduced motion.

## 2. Design tokens

All tokens are CSS custom properties in `frontend/src/app/globals.css`, mapped into the Tailwind theme with
`@theme inline`, and switched by `data-theme="light" | "dark"` on `<html>` (set before first paint by the
settings boot script; without JS the `prefers-color-scheme` media query applies).

### Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `--studio-hi` | `#fafafa` | `#2c2c2c` | backdrop center |
| `--studio-mid` | `#ececec` | `#1e1e1e` | backdrop middle, body fallback |
| `--studio-lo` | `#d6d6d6` | `#121212` | backdrop edge |
| `--ink` | `#111111` | `#f2f2f2` | bold headings, primary button, focus ring |
| `--text` | `#4a4a4a` | `#c4c4c4` | body text |
| `--muted` | `#646464` | `#9c9c9c` | secondary text (≥ 4.5:1 on glass) |
| `--faint` | `#7a7a7a` | `#8a8a8a` | thin display weight only (≥ 3:1, ≥ 24 px) |
| `--line` | `rgb(0 0 0 / .08)` | `rgb(255 255 255 / .08)` | hairlines |
| `--glass` | `rgb(255 255 255 / .52)` | `rgb(32 32 32 / .55)` | stage |
| `--glass-raised` | `rgb(255 255 255 / .72)` | `rgb(46 46 46 / .62)` | panels on the stage |
| `--glass-edge` | `rgb(255 255 255 / .85)` | `rgb(255 255 255 / .09)` | hairline border + inner highlight |
| `--surface` | `#ffffff` | `#2b2b2b` | white pills, inputs |
| `--good` | `#3c7a58` | `#86bd9c` | correct, best moves |
| `--bad` | `#a5443c` | `#e0928a` | wrong, check, blunder, loss |
| `--warn` | `#8a6a1f` | `#d4b56c` | inaccuracy |
| `--mistake` | `#9e5b26` | `#dca06b` | mistake |

Board themes are monochrome too (Studio, Graphite, Ink, Paper, High contrast), each with light-UI and dark-UI
square colors.

### Type

- **Display:** Barlow Semi Condensed 300 (thin, `--faint`) + 700 (bold, `--ink`), uppercase via CSS
  (DOM text stays sentence case for screen readers), tracking +0.005em.
- **Text:** Barlow 400 / 500 / 600, tabular figures for clocks, ratings and notation (no monospace).
- Self-hosted woff2 from `@fontsource` through `next/font/local` (preload + metric-matched fallback).

| Step | Size / line height | Use |
|---|---|---|
| `display-xl` | clamp(44px, 7.4vw, 104px) / 0.92 | home hero |
| `display-lg` | clamp(36px, 5vw, 64px) / 0.95 | page titles |
| `display-md` | clamp(26px, 3vw, 36px) / 1 | section titles, results |
| `title` | 20px / 1.25, 600 | card titles |
| `lead` | 18px / 1.6 | intro paragraphs |
| `body` | 16px / 1.65 | body |
| `small` | 14px / 1.5 | UI, meta |
| `caption` | 12.5px / 1.4 | captions (never below 12px) |

### Space, radius, shadow, blur, motion

- **Spacing:** 4 px base: 4 8 12 16 20 24 32 40 48 64 80 96 128.
- **Radius:** stage 32 (20 on phones) · panel 22 · control 14 · square inset 6 · pill 999. Radius shrinks with depth.
- **Shadow:** `--shadow-stage` (deep, very soft, two layers + inner highlight), `--shadow-raised` (white pills),
  `--shadow-press` (inset), `--shadow-piece` (contact shadow baked into sprites).
- **Blur:** stage 28 px saturate(140%) · panel 18 px · chip 12 px · scrim 6 px.
- **Motion:** `--dur-1` 120 ms (press), `--dur-2` 200 ms (hover, small state), `--dur-3` 320 ms (panels),
  `--dur-4` 560 ms (reveals), `--ease-out` cubic-bezier(.16,1,.3,1), `--ease-in-out` cubic-bezier(.65,0,.35,1);
  springs: snappy (600/30), smooth (320/32), soft (140/20). Exit ≈ 65 % of enter.
- **Z-index:** backdrop -1 · content 0 · sticky header 40 · dock/move bar 50 · popover 60 · toast 80 · confetti 90 · modal 100.

## 3. Components

| Layer | Components |
|---|---|
| Primitives | `Button` (primary black pill, secondary white pill, ghost, danger), `LinkButton`, `IconButton`, `Glass`, `DisplayTitle` (thin + bold + rule), `PageHeader`, `Segmented`, `Toggle`, `Slider`, `Select`, `Chip`/`Badge`, `Kbd`, `Modal`, `Sheet`, `Popover`, `Toaster`, `Skeleton`, `EmptyState`, `StatTile`, `Disclosure`, `ProgressBar`, `EyeMorph`, `Icons`, `PawnMark` |
| Shell | `StudioBackdrop` (gradient + depth-of-field pieces + parallax), `Stage`, `SiteHeader`, `MobileMenu`, `MobileDock`, `SiteFooter`, `PageShell` (view transitions), `LiveRegion` |
| 3D | procedural pieces (`three/pieces.ts`), materials, `HeroScene` (R3F, lazy), dev-only render lab, `scripts/render-3d.mjs` (sprites, hero frames, backdrop pieces) |
| Board | `Board` + `MeltSurface` (WebGL melt, CSS fallback), `PieceImage` (gloss sprites / Lumen / Classic), `Mist`, `Shatter`, `PromotionPicker`, `Arrows`, `EvalBar` |
| Game | `GameScreen`, `PlayerBar`, `StatusLine`, `QuickSetup` (before your first move), `GameActions`, `MoveInput` + `MobileMoveBar`, `MoveList`, `BlindStage` (the melted puddle), `ResultPanel`, `ReviewPanel`, `ReplayControls`, `EvalGraph`, `Clock`, `Confetti` |
| Pages | Home (`Hero`, `HeroVisual`, `ModeShowcase`, `InputShowcase`, `TrainShowcase`, `PuzzleShowcase`, `ProgressShowcase`), Train hub + `DrillRunner` + six drills, Puzzles, Stats + charts, Learn, Settings, Credits, 404 |

## 4. The new flow, step by step

1. **Land on `/`.** The stage shows BLINDFOLD (thin) CHESS (bold), one sentence, and a melting board with glossy
   pieces that fade away and come back. One black pill: **Play now**. Under it, the game you will get, in words:
   "White vs Candle (≈700), Ghost mode" with **Change** (optional, remembered).
2. **One click → live game.** Play now starts a game with the remembered setup (default White, Candle, Ghost) and
   navigates to `/play`; the hero board morphs into the game board (view transition). Status says *Your move*.
3. **Before your first move** the panel next to the board offers the visibility mode, opponent and colour (plus
   rated, clock, peeks and move list under *More options*). Changing them restarts the waiting game instantly.
   Nothing has to be touched.
4. **Play.** Type (`e4`, `knight f3`), click or drag, or speak. In Ghost mode the pieces fade three seconds after
   each move and the board melts. **Peek** (P) makes it solid for a moment. On phones the board is full width and
   the move bar sticks above the keyboard.
5. **Game over, in place.** The board solidifies, the king topples, confetti on a win. The side panel turns into
   the result; the review (eval bar, eval graph, move quality, replay) runs on the same board.
   **Play again** is one click and keeps the settings.
6. **Coming back.** `/` shows **Continue game** when a game is in progress (one click), with **New game** beside it.
7. **Train and puzzles.** A drill card starts the drill immediately at your last level (one tap). Puzzles open on
   a puzzle. Old links (`/play`, `/train/...`) all keep working.

Target click counts: home → live game 1 · home → game in another mode 1 (mode cards) · nav → drill running 1 ·
nav → puzzle 1 · game over → next game 1 · return visit → continue 1.

## 5. Page by page

| Page | Plan |
|---|---|
| **Home `/`** | Hero (copy left, melting board right, Play now / Continue). Mode showcase: five live mini boards, each starts a game in that mode. Input showcase: type / click / voice demos. Train showcase: six drill visuals. Puzzle showcase: a position in words with the reveal. Progress showcase: rating line + streak heat. Closing line + Play now. |
| **Play `/play`** | Board first. Player bars, board with melt, side panel (status, input, actions, moves) or quick setup before the first move. Game over and review in place. Mobile: full-width board, sticky move bar, dock hidden during a game. |
| **Train `/train`** | Thin/bold title, seven glass tiles with monochrome illustrations; tap = start at last level; level link. |
| **Drills (6)** | Intro (levels as a list, mode, Start), countdown, running (progress hairline, score, streak), feedback (good/bad), done (big percentage, stats, Again / Next level / Change level). `?go=1` skips the intro. |
| **Puzzles** | Opens on a puzzle. Filters as compact chips. Text position with piece icons, input, Peek/Hint/Read aloud/Solution. Hidden board shown as a melted pool until peek or the end. |
| **Stats** | KPI tiles, rating chart (solid + dashed series, legend, table view), grayscale heatmap, drill table with sparklines, puzzle bars, game accuracy, recent games with replay. Export / import / reset. Empty state with actions. |
| **Learn** | Long-form guide with sticky contents, drill pills, plan cards, history. |
| **Settings** | Appearance (Light / Dark / System), board theme, pieces (Gloss / Lumen / Classic), coordinates, figurine; blindfold; sound; voice; motion. Live preview board that melts on demand. |
| **Credits, 404** | Same stage and type; 404 shows a melted board and a toppled pawn. |
| **Modals, toasts, empty, loading** | Glass dialog and sheet, glass toasts (role=status, auto-dismiss), skeletons with a soft sheen, empty states that point to an action. |

## 6. Checklist

### Groundwork
- [x] Before screenshots (1440/390, light/dark) in `docs/design/before/`
- [x] This plan + `DECISIONS.md`

### Design system
- [ ] Tokens (color, radius, shadow, blur, spacing, type, motion) as CSS variables + Tailwind theme
- [ ] Barlow + Barlow Semi Condensed self-hosted via next/font/local
- [ ] Theme setting (System / Light / Dark), boot script, meta theme-color
- [ ] Primitives: Button family, Glass, DisplayTitle, PageHeader, Segmented, Toggle, Slider, Select, Chip, Kbd
- [ ] Modal, Sheet, Popover, Toaster, Skeleton, EmptyState, StatTile, Disclosure
- [ ] Remove the old palette (night/ivory/ember/moon/jade/coral) and fonts (Inter/Fraunces/JetBrains Mono)

### 3D
- [ ] Procedural pieces (lathe pawn/rook/bishop/queen/king, sculpted knight), porcelain + lacquer materials
- [ ] Render lab + `scripts/render-3d.mjs`: piece sprites (light/dark), silhouette token, hero frames, DoF backdrop pieces
- [ ] Lazy R3F hero scene on capable desktops; static frames elsewhere (no WebGL, reduced motion, low-end)

### Shell
- [ ] Studio backdrop with depth-of-field pieces and pointer/scroll parallax (off with reduced motion)
- [ ] Glass stage, header (pawn mark + wordmark, nav, settings), mobile menu + dock, footer
- [ ] Page transitions (fade/rise, melt into a game), header anchored

### Home and flow
- [ ] Hero with Play now / Continue game / New game, setup summary + Change popover
- [ ] Showcases: modes (start in that mode), input, train, puzzles, progress
- [ ] `/play` auto-starts with the remembered setup; quick setup before the first move
- [ ] Game over in place: reveal, result, review on the same board, Play again / Change setup
- [ ] Mobile: full-width board, sticky move bar above the keyboard, dock hidden in a game

### Board
- [ ] Monochrome board themes, gloss sprites with Lumen/Classic fallbacks
- [ ] Melt surface: ripple on hide, liquid at rest, solid on peek; CSS fallback; reduced-motion still frame
- [ ] Restyle: drag lift, spring moves, capture shatter, castling, check glow, mist, trail, flash, promotion, arrows
- [ ] Total blindfold stage (the melted pool), eval bar, eval graph, monochrome confetti

### Pages
- [ ] Train hub + one-tap start + remembered level
- [ ] Six drills (intro, countdown, running, feedback, done)
- [ ] Puzzles
- [ ] Stats + charts
- [ ] Learn
- [ ] Settings (incl. theme)
- [ ] Credits, 404
- [ ] Remove dead code from the old UI

### Quality
- [ ] Vitest updated + new unit tests
- [ ] Playwright updated + new flow tests (home → game in one click, play, game over, play again, continue)
- [ ] `make test`, `make lint`, `make e2e`, `next build` green; CI green
- [ ] Lighthouse mobile `/`: performance ≥ 85, accessibility 100
- [ ] Polish pass 1: visual fidelity to the reference
- [ ] Polish pass 2: flow and friction (click counts)
- [ ] Polish pass 3: motion, performance, accessibility (ui-ux-pro-max §1–9 + quick reference)
- [ ] After screenshots in `docs/design/after/`, README screenshots, `REDESIGN_REPORT.md`, CREDITS.md
- [ ] Pull request to `main` with before/after images
