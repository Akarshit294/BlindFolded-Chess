import { expect, type Page } from "@playwright/test";
import { Chess, type Square } from "chess.js";

export type BfState = { fen: string; turn: "w" | "b"; player: "w" | "b"; moves: string[]; result: unknown; thinking: boolean };

/** Fresh browser storage for a test. */
export async function resetStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("blindfold-chess");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
}

/** Errors that are expected when the API is deliberately unreachable. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR_FAILED|status of 404/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

export async function waitForPlayerTurnOrEnd(page: Page): Promise<BfState> {
  const handle = await page.waitForFunction(
    () => {
      const s = (window as unknown as { __bf?: BfState }).__bf;
      return s && (s.result || (s.turn === s.player && !s.thinking)) ? s : null;
    },
    null,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as BfState;
}

/** Screen position of a square's centre on the visible board. */
export async function squareCenter(page: Page, sq: Square, orientation: "white" | "black" = "white") {
  const box = (await page.locator('[aria-roledescription="chessboard"]').first().boundingBox())!;
  const file = sq.charCodeAt(0) - 97;
  const rank = sq.charCodeAt(1) - 49;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  const size = box.width / 8;
  return { x: box.x + (col + 0.5) * size, y: box.y + (row + 0.5) * size };
}

export async function clickSquare(page: Page, sq: Square, orientation: "white" | "black" = "white") {
  const c = await squareCenter(page, sq, orientation);
  await page.mouse.click(c.x, c.y);
}

/** Small seeded RNG so failures are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function startGame(page: Page, opts: { visibility: string; level?: number }) {
  await page.goto("/play?e2e=1");
  await page.getByTestId(`visibility-${opts.visibility}`).click();
  await page.getByTestId(`level-${opts.level ?? 10}`).click();
  await page.getByTestId("start-game").click();
  await expect(page.getByTestId("game-screen")).toBeVisible();
}

/**
 * Plays random legal moves (typed, or clicked on the hidden board) until the game ends.
 * Against full-strength Stockfish this finishes in a few dozen moves.
 */
export async function playUntilGameOver(page: Page, how: "type" | "click", seed = 1) {
  const rand = rng(seed);
  const input = page.getByTestId("move-input");
  for (let i = 0; i < 400; i++) {
    const s = await waitForPlayerTurnOrEnd(page);
    if (s.result) return s;
    const chess = new Chess(s.fen);
    const moves = chess.moves({ verbose: true });
    const mv = moves[Math.floor(rand() * moves.length)]!;
    if (how === "type") {
      await input.fill(mv.san);
      await input.press("Enter");
    } else {
      await clickSquare(page, mv.from);
      await clickSquare(page, mv.to);
      if (mv.promotion) await page.getByRole("button", { name: /Promote to queen/i }).click();
    }
    await page.waitForFunction((n) => ((window as unknown as { __bf?: BfState }).__bf?.moves.length ?? 0) > n, s.moves.length, { timeout: 15_000 });
  }
  throw new Error("Game did not finish");
}
