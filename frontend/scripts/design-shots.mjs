#!/usr/bin/env node
/**
 * Design screenshots for docs/design/. Drives a running app with Playwright and saves JPEGs of
 * every page (and, for the redesign, the key states) at 1440 px and 390 px, light and dark.
 *
 *   node scripts/design-shots.mjs --base http://127.0.0.1:3000 --out ../docs/design/after --set after
 *
 * --set before   pages only (the old UI had no in-game states worth scripting beyond one game)
 * --set after    pages plus key states (melt, peek, check, game over, review, every mode, drills, stats with
 *                sample data, keyboard)
 * --only a,b     only the named shots (handy while iterating)
 *
 * Uses PW_CHROMIUM_PATH or CHROME_PATH when Playwright's own browser is not installed.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { Chess } from "chess.js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((s) => {
      const [k, ...v] = s.trim().split(/\s+/);
      return [k, v.join(" ") || "1"];
    }),
);
const BASE = args.base ?? "http://127.0.0.1:3000";
const OUT = path.resolve(args.out ?? "../docs/design/after");
const SET = args.set ?? "after";
const ONLY = args.only ? new Set(args.only.split(",")) : null;
const SCHEMES = (args.schemes ?? "light,dark").split(",");
const WIDTHS = (args.widths ?? "1440,390").split(",").map(Number);

const DRILLS = ["square-color", "coordinates", "knight-routes", "lines", "where-piece", "memory"];

const executablePath = process.env.PW_CHROMIUM_PATH || process.env.CHROME_PATH || undefined;

/**
 * Waits for fonts, the images in view and a short settle so entrance animations finish. Lazy images below the
 * fold never load until scrolled to, so only images in the viewport count, and the wait is capped.
 */
async function settle(page, ms = 1500) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    const inView = (i) => {
      const r = i.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
    };
    const pending = [...document.images].filter((i) => !i.complete && inView(i));
    await Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => (i.addEventListener("load", r, { once: true }), i.addEventListener("error", r, { once: true }))))),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
  });
  await page.waitForTimeout(ms);
}

async function bfState(page) {
  return page.evaluate(() => window.__bf ?? null);
}

async function waitPlayerTurn(page) {
  await page.waitForFunction(() => {
    const s = window.__bf;
    return s && (s.result || (s.turn === s.player && !s.thinking));
  }, null, { timeout: 30_000 });
}

async function typeMove(page, san) {
  await waitPlayerTurn(page);
  const input = page.getByTestId("move-input").first();
  await input.fill(san);
  await input.press("Enter");
  await page.waitForTimeout(150);
}

/* ------------------------------------------------------------------------------ sample data */

/** A few weeks of plausible progress (games, drill sessions, puzzles) for the Stats page, as an export file. */
function sampleProgress(now = Date.now()) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const DAY = 86_400_000;
  const CLASSES = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];
  const games = [];
  const lines = [
    { san: "e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#", color: "w", result: { winner: "w", reason: "checkmate" }, vis: "ghost", level: 1, acc: 88.4 },
    { san: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 exd5", color: "w", result: { winner: "b", reason: "resign" }, vis: "silhouette", level: 4, acc: 71.2 },
    { san: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5", color: "w", result: { winner: null, reason: "agreement" }, vis: "ghost", level: 3, acc: 82.9 },
    { san: "f3 e5 g4 Qh4#", color: "b", result: { winner: "b", reason: "checkmate" }, vis: "empty", level: 2, acc: 93.5 },
    { san: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8", color: "w", result: { winner: "w", reason: "resign" }, vis: "ghost", level: 3, acc: 79.6 },
    { san: "e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#", color: "w", result: { winner: "w", reason: "checkmate" }, vis: "blind", level: 2, acc: 84.1 },
  ];
  let rating = 1200;
  lines.forEach((l, gi) => {
    const chess = new Chess();
    const moves = [];
    const sans = [];
    for (const m of l.san.split(" ")) {
      const mv = chess.move(m);
      moves.push(mv.from + mv.to + (mv.promotion ?? ""));
      sans.push(mv.san);
    }
    const started = now - (19 - gi * 3) * DAY - 3_600_000;
    const plies = moves.length;
    const score = l.result.winner === null ? 0.5 : l.result.winner === l.color ? 1 : 0;
    const before = rating;
    rating = Math.round(rating + 32 * (score - 0.45));
    const counts = () => Object.fromEntries(CLASSES.map((c) => [c, 0]));
    const classes = Array.from({ length: plies }, () => CLASSES[Math.min(5, Math.floor(rand() * rand() * 6))]);
    const cw = counts();
    const cb = counts();
    classes.forEach((c, i) => ((i % 2 === 0 ? cw : cb)[c] += 1));
    const curve = [50];
    for (let i = 0; i < plies; i++) curve.push(Math.max(2, Math.min(98, curve[i] + (rand() - 0.5) * 14)));
    games.push({
      id: `sample-game-${gi}`,
      config: { playerColor: l.color, levelId: l.level, visibility: l.vis, mode: gi % 2 ? "rated" : "practice", timeControl: null, peeks: 3, moveList: "full" },
      startedAt: started,
      updatedAt: started + plies * 9000,
      moves,
      sans,
      moveTimes: moves.map(() => 2500 + Math.round(rand() * 9000)),
      clocks: null,
      peeksUsed: Math.floor(rand() * 3),
      illegalAttempts: Math.floor(rand() * 2),
      takebacks: 0,
      result: l.result,
      endedAt: started + plies * 9000,
      ratingBefore: before,
      ratingAfter: rating,
      analysis: {
        source: "browser",
        accuracy: { white: l.color === "w" ? l.acc : 74, black: l.color === "b" ? l.acc : 74 },
        counts: { white: cw, black: cb },
        curve,
        classes,
        best: moves.map(() => null),
      },
    });
  });
  const drills = ["square-color", "coordinates", "knight-routes", "lines", "where-piece", "memory"];
  const sessions = [];
  const drillRatings = {};
  for (let d = 20; d >= 0; d--) {
    if (d % 5 === 3) continue; // a couple of rest days
    const n = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const drill = drills[Math.floor(rand() * drills.length)];
      const total = 20;
      const correct = Math.min(total, 12 + Math.floor(rand() * 9) + Math.floor((20 - d) / 6));
      const r = (drillRatings[drill] ?? { rating: 1200, played: 0, peak: 1200 });
      r.rating = Math.round(r.rating + (correct / total - 0.7) * 40);
      r.played += 1;
      r.peak = Math.max(r.peak, r.rating);
      drillRatings[drill] = r;
      sessions.push({ id: `sample-s-${d}-${k}`, drill, level: 1 + Math.floor((20 - d) / 7), timed: rand() > 0.5, startedAt: now - d * DAY - (k + 1) * 3_600_000, durationMs: 60_000 + Math.round(rand() * 60_000), correct, total, accuracy: correct / total, bestStreak: Math.round(correct * 0.6), ratingAfter: r.rating });
    }
  }
  const goals = ["mate1", "mate2", "mate3", "win"];
  const puzzles = [];
  let pr = 1200;
  for (let i = 0; i < 16; i++) {
    const solved = rand() > 0.3;
    pr = Math.round(pr + (solved ? 14 : -11));
    puzzles.push({ id: `sample-p-${i}`, puzzleId: `sample-${i}`, puzzleRating: 1100 + Math.round(rand() * 500), goal: goals[i % 4], solved, firstTry: solved && rand() > 0.3, mistakes: solved ? 0 : 1, peeks: Math.floor(rand() * 2), timeMs: 15_000 + Math.round(rand() * 60_000), ts: now - (18 - i) * DAY, ratingAfter: pr });
  }
  return {
    app: "blindfold-chess",
    version: 1,
    exportedAt: new Date(now).toISOString(),
    games,
    sessions,
    puzzles,
    ratings: { blindfold: { rating, played: games.length, peak: Math.max(rating, 1216) }, puzzles: { rating: pr, played: puzzles.length, peak: pr + 20 }, drills: drillRatings },
  };
}

async function importSample(page) {
  await page.goto(`${BASE}/stats`);
  await page.getByTestId("import-file").setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(sampleProgress())) });
  await page.getByTestId("import-merge").click();
  await page.getByTestId("import-message").waitFor();
  await page.goto(`${BASE}/stats`);
}

/* ----------------------------------------------------------------------------------- shots */

/** Plain pages: [name, path, wait-for selector or null]. */
const PAGES = [
  ["home", "/", null],
  ["play", "/play", null],
  ["train", "/train", null],
  ...DRILLS.map((d) => [`drill-${d}`, `/train/${d}`, null]),
  ["puzzles", "/puzzles", '[data-testid="puzzle"]'],
  ["stats", "/stats", null],
  ["learn", "/learn", null],
  ["settings", "/settings", null],
  ["credits", "/credits", null],
  ["404", "/no-such-page", null],
];

/** Scripted states (after set only). Each gets a fresh context. */
const STATES = {
  async "game-start"(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await settle(page, 600);
  },
  async "home-to-game"(page) {
    await page.goto(`${BASE}/`);
    await settle(page, 400);
    await page.getByTestId("play-now").click();
    await page.waitForTimeout(260);
  },
  async "ghost-fade"(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await typeMove(page, "e4");
    await waitPlayerTurn(page);
    await page.waitForTimeout(1500);
  },
  async melt(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await typeMove(page, "e4");
    await typeMove(page, "Nf3");
    await waitPlayerTurn(page);
    await page.waitForTimeout(4200);
  },
  async peek(page) {
    await STATES.melt(page);
    await page.getByTestId("peek").first().click();
    await page.waitForTimeout(700);
  },
  async "mid-drag"(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await page.getByTestId("visibility-full").first().click();
    await waitPlayerTurn(page);
    // On a phone the quick setup sits below the board: back to the top before picking up a piece.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const box = await page.locator('[aria-roledescription="chessboard"]').first().boundingBox();
    const sq = box.width / 8;
    const from = { x: box.x + 6.5 * sq, y: box.y + 7.5 * sq };
    const to = { x: box.x + 5.6 * sq, y: box.y + 5.7 * sq };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    await page.waitForTimeout(250);
  },
  async check(page) {
    // Full board, then play on until we can give check (any legal checking move), and show the king in check
    // before the engine answers (?e2e=2 keeps the engine's normal, human-paced reply).
    await page.goto(`${BASE}/play?e2e=2`);
    await page.getByTestId("game-screen").waitFor();
    await page.getByTestId("visibility-full").first().click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const opening = ["e4", "Bc4", "Qf3", "Nc3", "d3", "Nge2", "a3"];
    for (let i = 0; i < 12; i++) {
      await waitPlayerTurn(page);
      const s = await bfState(page);
      if (!s || s.result) break;
      const chess = new Chess(s.fen);
      const checking = chess.moves({ verbose: true }).find((m) => m.san.includes("+"));
      if (checking) {
        await page.evaluate(() => window.scrollTo(0, 0));
        const input = page.getByTestId("move-input").first();
        await input.fill(checking.san);
        await input.press("Enter");
        await page.waitForTimeout(260);
        return;
      }
      const next = opening.find((m) => chess.moves().includes(m)) ?? chess.moves()[0];
      await typeMove(page, next);
    }
  },
  async "game-over"(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await typeMove(page, "e4");
    await waitPlayerTurn(page);
    await page.getByTestId("resign").first().click();
    const confirm = page.getByTestId("confirm-resign");
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.getByTestId("game-over").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2400);
  },
  async review(page) {
    await STATES["game-over"](page);
    await page.getByTestId("review").scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(2500);
  },
  async blindfold(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await page.getByTestId("visibility-blind").first().click();
    await typeMove(page, "e4");
    await waitPlayerTurn(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);
  },
  async silhouette(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await page.getByTestId("visibility-silhouette").first().click();
    await typeMove(page, "e4");
    await typeMove(page, "Nf3");
    await waitPlayerTurn(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
  },
  async "empty-board"(page) {
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await page.getByTestId("visibility-empty").first().click();
    await typeMove(page, "d4");
    await waitPlayerTurn(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
  },
  async "drill-memory-running"(page) {
    await page.goto(`${BASE}/train/memory?go=1`);
    await page.getByTestId("drill-running").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1200);
  },
  async "drill-where-piece-running"(page) {
    await page.goto(`${BASE}/train/where-piece?go=1`);
    await page.getByTestId("drill-running").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1200);
  },
  async "drill-running"(page) {
    await page.goto(`${BASE}/train/knight-routes?go=1`);
    await page.getByTestId("drill-running").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);
  },
  async "drill-done"(page) {
    // A short session of square colours with one slip, then the end screen.
    await page.goto(`${BASE}/train/square-color?go=1`);
    await page.getByTestId("drill-running").waitFor({ timeout: 15_000 });
    for (let i = 0; i < 9; i++) {
      const prompt = page.getByTestId("drill-prompt").last();
      await prompt.waitFor();
      const text = (await prompt.textContent()) ?? "";
      const sq = (text.match(/[a-h][1-8]/) ?? [])[0];
      if (!sq) break;
      const dark = (sq.charCodeAt(0) - 97 + (sq.charCodeAt(1) - 49)) % 2 === 0;
      const pick = i === 4 ? !dark : dark;
      await page.getByTestId(pick ? "choice-dark" : "choice-light").click();
      await page.waitForTimeout(200);
      const next = page.getByTestId("drill-next");
      if (await next.isVisible().catch(() => false)) await next.click();
      await page.waitForFunction((t) => (document.querySelectorAll('[data-testid="drill-prompt"]').item(document.querySelectorAll('[data-testid="drill-prompt"]').length - 1)?.textContent ?? "") !== t, text, { timeout: 4000 }).catch(() => undefined);
    }
    await page.getByRole("button", { name: "End" }).click();
    await page.getByTestId("drill-done").waitFor();
    await page.waitForTimeout(1800);
  },
  async "stats-data"(page) {
    await importSample(page);
    await page.getByTestId("games-table").waitFor({ timeout: 15_000 });
    await settle(page, 1200);
  },
  async "stats-replay"(page) {
    await importSample(page);
    await page.getByTestId("games-table").getByRole("button", { name: "Replay" }).first().click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(1500);
  },
  async "mobile-keyboard"(page) {
    // A phone with the on-screen keyboard open: the visual viewport shrinks to about half.
    await page.setViewportSize({ width: 390, height: 470 });
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await page.getByTestId("move-input").first().focus();
    await page.getByTestId("move-input").first().fill("Nf");
    await page.waitForTimeout(600);
  },
};

const shots = [];
for (const [name, p, wait] of PAGES) shots.push({ name, run: async (page) => {
  await page.goto(`${BASE}${p}`);
  if (wait) await page.locator(wait).first().waitFor({ timeout: 20_000 });
  await settle(page);
} });
if (SET === "before") {
  shots.push({
    name: "play-game",
    run: async (page) => {
      await page.goto(`${BASE}/play?e2e=1`);
      await page.getByTestId("visibility-ghost").click();
      await page.getByTestId("start-game").click();
      await page.getByTestId("game-screen").waitFor();
      await typeMove(page, "e4");
      await waitPlayerTurn(page);
      await page.waitForTimeout(1200);
    },
  });
} else {
  for (const [name, run] of Object.entries(STATES)) shots.push({ name, run });
}

const browser = await chromium.launch({ executablePath, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
await mkdir(OUT, { recursive: true });
let failures = 0;
for (const shot of shots) {
  if (ONLY && !ONLY.has(shot.name)) continue;
  for (const width of WIDTHS) {
    if (shot.name === "mobile-keyboard" && width !== 390) continue;
    for (const scheme of SCHEMES) {
      const mobile = width < 600;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 },
        deviceScaleFactor: mobile ? 2 : 1,
        isMobile: mobile,
        hasTouch: mobile,
        colorScheme: scheme,
      });
      const page = await context.newPage();
      const file = path.join(OUT, `${shot.name}-${width}-${scheme}.jpg`);
      try {
        await shot.run(page);
        await page.screenshot({ path: file, type: "jpeg", quality: 72 });
        console.log("✓", path.relative(process.cwd(), file));
      } catch (e) {
        failures++;
        console.error("✗", shot.name, width, scheme, e.message.split("\n")[0]);
        await page.screenshot({ path: file, type: "jpeg", quality: 72 }).catch(() => undefined);
      }
      await context.close();
    }
  }
}
// Full-page captures of the home page show the whole pitch.
if (!ONLY || ONLY.has("home-full")) {
  for (const width of WIDTHS) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, colorScheme: SCHEMES[0] });
    const page = await context.newPage();
    await page.goto(`${BASE}/`);
    await settle(page);
    // Scroll through once so in-view animations have run.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    const file = path.join(OUT, `home-full-${width}-${SCHEMES[0]}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 65, fullPage: true });
    console.log("✓", path.relative(process.cwd(), file));
    await context.close();
  }
}
await browser.close();
if (failures) {
  console.error(`${failures} shot(s) failed`);
  process.exitCode = 1;
}
