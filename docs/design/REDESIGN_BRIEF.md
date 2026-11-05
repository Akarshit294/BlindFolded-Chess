# Redesign brief: new UI/UX for Blindfold Chess

You are redesigning the ENTIRE frontend of this app: every page, every component, and the user flow. Work fully on your own. The owner is not available to answer questions. Never stop to ask: make the sensible choice, write it in `docs/design/DECISIONS.md`, and keep going. The result must be finished, working and beautiful.

The game logic, engine, drills, puzzles, stats and the Python backend already work and are well tested. This is a redesign of the presentation and the flow, not a rewrite of the logic. Keep every feature working.

## 1. Look and feel

Open `docs/design/style-reference.jpeg` and study it before you design anything. It is the mood and style target. Do not copy its artwork, text or layout pixel for pixel. Make an original design that clearly belongs to the same family.

The image is the source of truth. The notes below say what to take from it and what it cannot show (dark mode, the board, every other page, how to build the 3D for free). Exact values in them (colors, radius, font names, sizes) are only starting points. Change them whenever your own screenshots show that something else works better. The principles are fixed: monochrome, frosted glass, glossy pieces, depth, the melting board as the blindfold motif, color only for meaning, and readable contrast.

What defines the style:

- **Monochrome studio.** Only white, light grays, charcoal and black. The background is a soft light-gray backdrop: a radial gradient from near-white in the center to about `#d6d6d6` at the edges, like a photo studio sweep.
- **Depth of field.** Big chess pieces, very out of focus, float at the edges of the screen behind the content. Add subtle parallax with the pointer and scroll. Turn it off when reduced motion is on.
- **Frosted glass stage.** The main content sits on a large frosted-glass card floating above the backdrop. Use a radius of about 24-32px, translucent white, backdrop blur, a hairline white border with an inner highlight, and a deep, very soft shadow.
- **Typography.** Use a clean grotesque or condensed sans such as Barlow or Barlow Semi Condensed (OFL, via fontsource or next/font, self-hosted). Headlines are uppercase and mix a thin gray weight with a bold black weight in one line, e.g. "BLINDFOLD" thin gray + "CHESS" bold black. Put a short thin black rule under the main headline. Body text is small, gray and has generous line height.
- **Buttons are pills.** Primary is solid near-black with white text. Secondary is a white pill with a soft shadow. Hover gives a gentle lift. Press gives a small scale-down.
- **Glossy 3D pieces.** Black pieces look like glossy black lacquer and white pieces look like white porcelain. Each piece has a soft contact shadow and real reflections.
- **Signature motif: the melting board.** A checkerboard that warps and flows like liquid, as in the reference. Use it to mean "blindfold". When the pieces hide, the board ripples and melts. A peek makes the board solid again for a moment. Use it in the hero, in transitions, and in the blindfold modes.
- **Color only carries meaning,** and stays desaturated: check, correct/wrong answers, the eval bar, move quality. Everything else is grayscale.
- **Dark theme.** The same design in a charcoal studio with smoked glass, still monochrome.
- **Never cheap.** No default Tailwind look, no generic gradients, no emoji. Use generous whitespace and a strict spacing and type scale.

### Tools set up for you in this repo
- **Design skill:** `.claude/skills/frontend-design/SKILL.md`. Load it (Skill tool: `frontend-design`) before you design anything, and follow it.
- **UX and accessibility checks:** `.claude/skills/ui-ux-pro-max/SKILL.md`. Use it ONLY for usability rules and checks: accessibility, contrast, touch targets, motion, navigation, forms, and the `nextjs`, `react` and `threejs` stack guidance. Do NOT use its `--design-system` output or its palette, font or style picks: the reference image and this brief decide the look. If it ever disagrees with this brief, this brief wins. Its SKILL.md points at `${CLAUDE_PLUGIN_ROOT}/...`, which does not exist here. Run the tool from the repo root as `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux` (or `--stack nextjs`). Never use `--persist`.
- **Browser you can drive:** `.mcp.json` starts a Playwright MCP server (tools named `mcp__playwright__*`: navigate, click, type, drag, screenshot, resize). In cloud sessions it uses the preinstalled Chrome at `$CHROME_PATH`. Use it to click through flows and look at the result.
- **Scripted screenshots and e2e:** `@playwright/test` is already in `frontend/`. In the cloud sandbox, run it with `PW_CHROMIUM_PATH=$CHROME_PATH` (the config honours it), because Playwright's browser download is usually blocked there.
- If any of these is missing or broken, note it in DECISIONS.md and use whatever else works. Never stop because of it.

### 3D, built for free
- Use Three.js with React Three Fiber and drei. Model the pieces yourself, procedurally: `LatheGeometry` profiles for pawn, rook, bishop, queen and king, and a sculpted or extruded knight. That way there are no downloads and no licensing questions. CC0 models (for example from Poly Haven) are acceptable if you prefer them, credited in CREDITS.md.
- Materials: `MeshPhysicalMaterial` with clearcoat. Lighting: `RoomEnvironment` for reflections, so no HDRI download is needed. Add contact shadows. Use postprocessing depth of field for the blurred background pieces.
- The playable board must stay fast, crisp, accessible and touch-friendly. Recommended approach: pre-render the 3D pieces into high-resolution sprites (WebP/AVIF, light and dark variants) with a script you commit, e.g. a Playwright or Node script that renders the Three.js scene. The 2D board then uses those sprites. A real 3D board view is an optional stretch goal and must not replace the 2D board.
- Lazy-load Three.js. The board must be playable before any 3D finishes loading. Provide a static image fallback when WebGL is missing, reduced motion is on, or the device is low-end.
- Keep the existing animation quality: spring moves, drag lift, capture shatter, castling choreography, check glow, fog, peek and confetti. Restyle them all to the monochrome glass look. Keep the synthesized sounds.

## 2. User flow: from landing to playing, fast

**Goal:** a visitor understands what this site is within seconds, wants to try it, and is playing a blindfold game with as little friction as possible. How to get there is your call as the designer. Pick what you believe is best and write down why in `docs/design/DECISIONS.md`.

Two good directions, or a hybrid of them:
- **Hero first.** A striking home page that sells the idea and shows the strong points (play Stockfish blindfolded, five visibility modes, voice moves, training drills, puzzles, progress stats, free with no sign-up). It has one clear **Play now** button that drops you straight into a game.
- **Board first.** The home page shows a live board, and your first move starts the game.

Whatever you choose:
- **Show, don't tell.** The home page shows the strong points with motion and visuals, not walls of text. Seeing the pieces fade away should make people want to try it.
- **One click (or one move) from the home page to a live game,** with no mandatory setup screen in between. Defaults: White, a friendly level, **Ghost** mode, so the blindfold idea is felt right away. Level, visibility mode and color are easy to change but optional, and remembered between visits.
- **Returning visitors** with a game in progress can continue in one click.
- **Game over** happens in place: cinematic reveal, then the review (replay, eval graph, move quality). "Play again" is one click and keeps the settings.
- **Navigation:** a logo (pawn mark + wordmark), Play, Train, Puzzles, Stats, Learn, and Settings. There are no accounts, so do not add a fake "Sign up".
- **Old links** such as `/play` keep working.
- **Mobile:** during a game the board comes first at full width, with a sticky move-input bar that stays above the on-screen keyboard. Everything is reachable with a thumb.
- **Low friction everywhere.** In Train, one tap starts a drill with sensible defaults. Puzzles open straight onto a puzzle.

## 3. Redesign every page

Home/Play, Train hub and all six drills, Puzzles, Stats, Learn, Settings, Credits, 404, plus every modal, toast, empty state, loading and skeleton state, and the game review. Keep one consistent design system: tokens for color, radius, shadow, blur, spacing, type scale and motion, all in CSS variables and Tailwind theme. Build shared components and use them everywhere. Remove dead code from the old UI.

## 4. Must not regress

- Every feature in `MORNING_REPORT.md` keeps working: engine levels, five visibility modes, typed, clicked and voice input, spoken moves, peeks, practice vs rated, takeback, clock, all rules, refresh-restore, review, drills, puzzles, stats with export and import, settings, backend-down fallback, keyboard access, the ARIA live region, reduced motion, light and dark themes.
- Do not change the backend unless you must.
- Update the Vitest and Playwright tests for the new flow and add tests for it: from the home page to a live game in one click or move, play, game over, play again, and continue a saved game. `make test`, `make lint`, `make e2e` and `next build` must all pass, and CI must be green.
- Performance: Lighthouse mobile performance at 85 or more on `/`, and accessibility at 100. Check text contrast in the gray-on-gray style carefully. Light gray text on light gray backgrounds is the classic failure of this look.
- $0 cost: no paid services, fonts or assets. Credit every asset in CREDITS.md.

## 5. How to work

1. Before changing anything, run the current app and take "before" screenshots of every page with Playwright, at 1440px and 390px, in light and dark. Save them in `docs/design/before/`.
2. Write `docs/design/REDESIGN_PLAN.md` with the design tokens, type scale, component list, the new user flow (step by step) and the page-by-page plan, plus a checklist. Tick items as you finish them.
3. Build in this order: design system and tokens, then the shell (backdrop, glass stage, nav), then the play-first home, then pieces and board, then every other page, then motion polish.
4. Commit after each meaningful step with clear messages and push often.
5. Check visually all the time. Screenshot every page and key state (home page, home-to-game transition, mid-drag, ghost fade, melt, peek, check, game over, review, each drill, puzzles, stats, settings, mobile keyboard open) at 1440px and 390px, light and dark. Open the screenshots and compare them side by side with `docs/design/style-reference.jpeg`. Fix anything off: alignment, spacing, contrast, jank, anything that looks generic. If a Playwright MCP browser is available, also click through the flows interactively.
6. When the checklist is done, do at least 3 full polish passes: (a) visual fidelity to the reference style, (b) flow and friction (count the clicks to the first move and to every feature, and reduce them), (c) motion, performance and accessibility, going through the ui-ux-pro-max priority table (sections 1-9) and `references/quick-reference.md` item by item. Re-screenshot after each pass.
7. Do not stop early. If something blocks you, pick a fallback, note it in DECISIONS.md, and continue.
8. Finish with: before/after screenshots in `docs/design/after/`, an updated README (new screenshots), `docs/design/REDESIGN_REPORT.md` (what changed, the new flow, what to try first, known issues), and a pull request to `main` with before/after images in the description.

**Definition of done:** open `localhost:3000` and you are looking at a stunning monochrome glass-and-gloss chess page that makes you want to play. One click or move later, you are in a blindfold game. Every other page matches that design. All tests and CI pass. It feels premium on desktop and on a phone.
