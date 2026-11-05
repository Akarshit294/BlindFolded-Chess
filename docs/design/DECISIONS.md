# Redesign decisions

Every judgement call made while redesigning the frontend without being able to ask. Newest entries are appended
to each section. The older product and engineering decisions from the first build are still in the root
[`DECISIONS.md`](../../DECISIONS.md).

## Process and tooling

- **Screenshots.** JPEG at quality 72 to keep the repository small: desktop at 1440×900 with device scale 1,
  phones at 390×844 with device scale 2. The old UI was dark-only (`color-scheme: dark`, no theme switch), so its
  "light" captures in `before/` are identical to the dark ones; they are kept so before/after pairs line up.
  The script is `frontend/scripts/design-shots.mjs` and is reused for `after/`.
- **Tools.** The design skill (`frontend-design`) and the UX checks (`ui-ux-pro-max`, run as
  `python3 .claude/skills/ui-ux-pro-max/scripts/search.py … --domain ux`) both work. Only the UX rules and the
  `nextjs`, `react` and `threejs` stack notes from ui-ux-pro-max are used; its palette/font/style picks are not.
  Playwright drives the preinstalled Chrome (`PW_CHROMIUM_PATH=$CHROME_PATH`).
- **Build order.** The brief's order is tokens → shell → home → pieces/board → pages → motion. The 3D render
  pipeline moved up to just after the tokens, because the shell (depth-of-field backdrop pieces) and the home
  hero both use its images.

## Look and feel

- **Name of the look: "Studio".** A photo-studio sweep, one frosted stage, glossy pieces, a melting board.
- **Typefaces.** Barlow Semi Condensed 300 + 700 for uppercase display lines (thin gray word + bold black word),
  Barlow 400/500/600 for everything else. A specimen render compared Barlow 300/700, Barlow 200/700 and the semi
  condensed cut: the semi condensed cut reads more like a poster, keeps long titles on one line on phones and is
  still the same family as the reference. Fraunces, Inter and JetBrains Mono are dropped: Barlow has tabular
  figures (`tnum`), which is all the clocks, ratings and move lists needed from a monospace.
- **Uppercase is CSS only.** Headings are written in sentence case in the DOM and uppercased with
  `text-transform`, so screen readers read words, not letters, and tests can match natural text.
- **No all-caps labels.** Small labels, badges and section labels are sentence case. Only the display lines are
  uppercase, as the reference asks.
- **Gray values were chosen for contrast first.** Body `#4a4a4a`, secondary `#646464` (≥ 4.5:1 even on the darker
  edge of the glass, about `#e6e6e6`), thin display gray `#7a7a7a` used only at ≥ 24 px (≈ 3.8:1, large text).
- **Meaning colors** are desaturated: green `#3c7a58` (good), red `#a5443c` (bad/check), ochre `#8a6a1f`
  (inaccuracy), rust `#9e5b26` (mistake). Lighter tints of the same hues in dark mode.
- **Board themes became monochrome.** The six colored themes (Nocturne, Walnut, Glacier, Moss, Rosewood,
  High contrast) are replaced by Studio, Graphite, Ink, Paper and High contrast. Saved settings migrate
  (Nocturne/Glacier → Studio, Walnut/Moss/Rosewood → Graphite, High contrast stays).
- **Pieces.** New default "Gloss" set: porcelain and lacquer pieces rendered from procedural Three.js models into
  WebP sprites. "Lumen" (the original flat set, recolored monochrome) and "Classic" (cburnett) stay as options.
  Saved settings that still hold the old default (`lumen`) move to Gloss; an explicit Classic choice is kept.

## Flow

- **Hero first, board first on `/play`.** The home page leads with the pitch and the melting 3D board, because the
  reference is a hero page and a flat board would lose the effect. Its single black pill, **Play now**, starts a
  game and lands on `/play` in one click. `/play` itself is board first: with no game in progress it starts one
  with the remembered setup straight away, so the first move is the start. There is no setup screen any more.
- **The game stays at `/play`.** Old links keep working without redirects, refresh-restore keeps its URL, and the
  home page stays light (no chess.js, board or engine in its bundle).
- **Defaults:** White, level 2 "Candle" (≈700) and Ghost mode. Candle is the friendliest level that still plays
  real chess: Ember (≈400) hangs pieces on purpose, and blindfold play is hard enough at first. The old default
  was Lantern (≈1000).
- **Changing the setup.** Before your first move, a compact panel beside the board offers mode, opponent and
  colour (rated, clock, peeks and move list under *More options*). Each change restarts the waiting game at once;
  as Black, the engine's opening move is replayed with the new setting. The setup is persisted, as before.
- **Continue.** A game in progress with at least one move shows **Continue game** as the primary action on the
  home page, with the mode, opponent and move number. A game with no moves is not worth "continuing", so the home
  page offers Play now instead.
- **Game over in place.** The review uses the game's own board (eval bar beside it, replay controls under it)
  instead of a second board further down the page. **Play again** rebuilds the config from the remembered setup,
  so "Random" colour re-rolls.
- **Mobile navigation.** A glass dock with the five main destinations sits at the bottom for thumb reach; the
  header has the logo, settings and a menu with every page. During a live game the dock gives way to the move bar.

## 3D

- **Runtime policy.** Three.js, React Three Fiber and drei are loaded only for the live hero scene, only on
  devices that can afford it (viewport ≥ 1024 px, WebGL 2, no reduced motion, no Save-Data, ≥ 4 cores), and only
  after the page is idle. Everyone else sees pre-rendered frames of the same scene, crossfaded to show the
  pieces fading. The playable board never waits for 3D: it uses pre-rendered sprites (and the flat sets).
- **The melting 2D board uses raw WebGL, not Three.js.** It is one fragment shader (domain-warped checker with
  soft edges and a fake specular sheen) behind the DOM pieces: a few kilobytes, no scene graph, and it stops
  rendering whenever the board is solid. Without WebGL, or with reduced motion, it falls back to a still,
  softened board.
