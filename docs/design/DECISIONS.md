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
- **The stage is translucent, not backdrop-filtered.** A `backdrop-filter` on the page-sized stage rendered in
  visible tiles (seams every few hundred pixels) in headless Chrome's software compositor, and it costs a
  full-page blur on every scroll frame on phones. Everything behind the stage is the studio backdrop, whose pieces
  are already rendered out of focus with real depth of field, so a translucent white fill gives the same frosted
  look. Real backdrop blur is kept where content scrolls underneath: the floating header, the phone dock, the move
  bar, toasts and dialogs.
- **CSS Modules are not used.** The project's Turbopack rule sends every `*.css` file through the Tailwind loader as
  plain CSS, so module class names are not hashed. Page-specific styles live in `globals.css` under prefixed class
  names (`hv-`, `mb-`, `demo-`).
- **Board pieces have no baked shadow.** Sprites are rendered without a contact shadow; the board draws a soft
  CSS shadow under each piece, so a dragged piece lifts off its shadow, which stays on the board and softens.
- **Hidden boards melt in place.** Ghost (when the pieces fade), silhouette and empty-board modes redraw the
  squares with the WebGL melt at different strengths (silhouette and empty boards melt less, so tokens and
  coordinates stay readable), and a ripple runs out from the last move. A peek solidifies the board in about a
  quarter of a second. In end-to-end tests (`?e2e=1`) the melt draws a still frame to keep software rendering
  cheap.

## Polish passes

Three passes after everything was built, each followed by a full set of screenshots (every page and the key
states at 1440 and 390 px, light and dark).

### Pass 1: visual fidelity to the reference

- **Hidden boards show the melt again.** The melt canvas was created in JSX and its context lost in the effect
  cleanup, so whenever the effect ran again on the same element (Strict Mode in development, or a cached route that
  Next.js hides and shows again) it silently fell back to a flat CSS layer. The canvas is now created inside the
  effect, one per run. The puzzle and blind-mode veils are lighter, so the melted squares read through them, and the
  no-WebGL fallback draws soft squares where there are none underneath.
- **Chess casing.** Square names and SAN in drill chips and the home demos had inherited the display face's
  uppercase (`B7`, `NF3`). Notation keeps its own casing everywhere; uppercase is for titles only.
- **Drill intros use the width.** On wide screens the setup sat in the left half of an empty stage. A preview column
  now shows the drill's own picture, enlarged, with the chosen level described under it, mirroring the home hero's
  "words left, object right" composition.
- **Charts.** The puzzle rating series is dashed as its legend says (the draw-in animation set its own dash array
  and overwrote it; lines now reveal with a clip wipe), and a series no longer starts with a vertical tick from the
  1200 starting point a millisecond before the first rating. The eval graph is a little lighter and shorter.
- **The floating header and the phone dock blur again.** Their `view-transition-name` (which keeps them anchored
  during page transitions) sat on a wrapper, and a named element is a backdrop root: the glass inside could only
  blur its own transparent wrapper, so text behind the dock stayed sharp. The names now sit on the glass bars
  themselves.
- **Smaller fixes.** The 404 pawn is bigger, with a contact shadow, so it reads as toppled; the mode picker says
  "Blindfold" (not "blindfold"); an empty per-answer time is a dash.

### Pass 2: flow and friction (click counts)

Counted on the new build against `main`, from a fresh profile:

| Task | Before (`main`) | After |
|---|---|---|
| Home → a game waiting for your first move | 2 clicks (Play, then Start game on the setup screen) | 1 click (Play now) |
| Continue a game in progress from home | 1 click, labelled "Play" | 1 click, labelled "Continue game", with "Move N of your … game" |
| Play again after a game, same settings | 1 click (Rematch) | 1 click (Play again), on the same page, with the review beside it |
| Start a game in another mode | 3 clicks (Play, pick the mode, Start game) | 1 click on a mode card on home, or 1 click in the quick setup before the first move |
| Start a drill from the Train page | 2 clicks (card, then Start) | 1 tap (the card starts it at your last level) |
| Open a puzzle | 0 clicks | 0 clicks |

- **Two flow bugs found by repeating the new end-to-end tests.** (1) `/play?new=1&mode=…` dropped its parameters
  with `history.replaceState(history.state, …)`. Passing Next.js's own history state makes Next treat the call as
  internal and skip syncing its router, which then wrote the old URL back on its next update, so a reload could
  start yet another game. The call now passes `null`, as the Next.js docs show, and a test reloads after Play again.
  (2) The `/play` and drill pages read their one-shot parameters from `window.location` once, on mount; on a
  client-side navigation that can run before the address bar changes, and "New game" then continued the old game.
  The intent now comes from `useSearchParams` (in a small component inside its own Suspense boundary, so the rest of
  the page stays prerendered) and is acted on whenever it appears, in a layout effect so the old board never flashes.
  The same fix makes a drill's one-tap start work under React Strict Mode in development.
- **Kept:** there is no "New game" button inside a running game. Abandoning a game is a resignation (with the
  confirmation setting respected), and the result panel then offers Play again; a second way out would make it too
  easy to throw away a game by accident. Home offers "New game" next to "Continue game".
- **Kept:** the quick setup sits under the board on phones. The board and the move bar are what a player needs first;
  the setup is one scroll away and every change restarts the waiting game.

### Pass 3: motion, performance and accessibility

Checked against ui-ux-pro-max §1–9 and `references/quick-reference.md`, with axe-core (WCAG 2.0–2.2 A/AA plus best
practices) on every page and on the main states (peek, resign dialog, game over with review, running drill, setup
dialog), in both themes at 1440 and 390 px, and Lighthouse on `/` (mobile).

- **Contrast.** The light theme's semantic colors were darkened (`--good` #326b4b, `--warn` #7c5e19, `--mistake`
  #8f5120) so text in them keeps 4.5:1 on the lightest glass panel. The flashing squares of the empty-board demo now
  tint over the square instead of replacing its color, so their coordinates keep their contrast. The knight-routes
  placeholder no longer sits at 90 % opacity.
- **Structure.** The puzzle position is a valid description list; the phone move bar (portalled to the body) is a
  labelled region; a running drill and its countdown have an `<h1>`.
- **Decorative demos are inert.** The home page's little demos (typed letters, suggestion chips, captions) fade their
  text in and out. They were already hidden from assistive technology, but a contrast check that lands mid-fade
  sees nearly invisible text, so Lighthouse's accessibility score varied between runs. They are also `inert` now
  (non-interactive, out of the accessibility tree), which is what they are; four Lighthouse runs in a row score 100.
- **Focus not obscured.** `scroll-padding` keeps keyboard focus and in-page links clear of the sticky header and,
  on phones, of the dock or the move bar.
- **Targets.** Everything meets WCAG 2.2's 24 px minimum (or its spacing exception). The small text links that are
  easy to miss on a phone (footer, "All drills", the Train cards' level link, drill names in Stats) and the sliders
  (a 4 px element, now a 28 px control with a 4 px track) have larger hit areas without moving anything.
- **Motion.** With reduced motion there are no loops, no parallax and no transforms; only the ghost fades remain,
  as opacity. Modal exits run at about two thirds of the entrance. The melt shader now also stops while it is off
  screen (the 3D hero already did).
- **Performance.** Lighthouse mobile on `/`: performance 87, accessibility 100, best practices 96, SEO 100. The
  one best-practices miss is the console line Chrome prints when the optional API is unreachable (the offline mode
  working as designed). LCP is the hero frame, which loads in about a second; the simulated LCP of about 4 s is the
  React, Next.js and Motion runtime evaluated before it under 4× CPU throttling. Cutting further means splitting the
  game store (which imports chess.js and IndexedDB code) from the home page and moving Motion to lazily loaded
  features across every component: a broad, risky change for a few points once the bar is met, so it is noted
  here rather than done.
- **Tooling.** `scripts/design-shots.mjs` waits only for images in view (lazy images below the fold never load
  and used to hang it), captures a populated Stats page and a replay from generated sample data, a real drill
  result, and the check glow before the engine answers. `?e2e=2` keeps the test hook but leaves the engine's
  human-paced reply on, for screenshots of short-lived states.
