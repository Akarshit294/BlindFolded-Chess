#!/usr/bin/env node
/**
 * Design screenshots for docs/design/. Drives a running app with Playwright and saves JPEGs of
 * every page (and, for the redesign, the key states) at 1440 px and 390 px, light and dark.
 *
 *   node scripts/design-shots.mjs --base http://127.0.0.1:3000 --out ../docs/design/after --set after
 *
 * --set before   pages only (the old UI had no in-game states worth scripting beyond one game)
 * --set after    pages plus key states (melt, peek, check, game over, review, drills, keyboard)
 * --only a,b     only the named shots (handy while iterating)
 *
 * Uses PW_CHROMIUM_PATH or CHROME_PATH when Playwright's own browser is not installed.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

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

/** Waits for fonts, images and a short settle so entrance animations finish. */
async function settle(page, ms = 900) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all(
      [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => ((i.onload = r), (i.onerror = r)))),
    );
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
    await page.goto(`${BASE}/play?e2e=1`);
    await page.getByTestId("game-screen").waitFor();
    await page.getByTestId("visibility-full").first().click();
    for (const m of ["e4", "Bc4", "Qh5"]) await typeMove(page, m);
    // Play on until the engine gives check or we give one: Qxf7+ is check if f7 is still defended weakly.
    const s = await bfState(page);
    if (s && !s.result) {
      for (const m of ["Qxf7+", "Bxf7+", "Qxe5+", "Qh5"]) {
        const st = await bfState(page);
        if (!st || st.result) break;
        const ok = await page.evaluate((san) => {
          const st = window.__bf;
          return !!st;
        }, m);
        if (!ok) break;
        await typeMove(page, m);
        const after = await bfState(page);
        if (after && after.fen && after.moves.length && after.fen.includes("+")) break;
        break;
      }
    }
    await page.waitForTimeout(400);
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
    await page.waitForTimeout(900);
  },
  async "drill-running"(page) {
    await page.goto(`${BASE}/train/knight-routes?go=1`);
    await page.getByTestId("drill-running").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);
  },
  async "drill-done"(page) {
    await page.goto(`${BASE}/train/square-color?go=1`);
    await page.getByTestId("drill-running").waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "End" }).click();
    await page.getByTestId("drill-done").waitFor();
    await page.waitForTimeout(1200);
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
