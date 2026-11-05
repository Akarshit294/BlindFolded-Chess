import { expect, test, type Page } from "@playwright/test";
import { Chess, type PieceSymbol, type Square } from "chess.js";
import { clickSquare, resetStorage } from "./helpers";

const NAMES: Record<string, PieceSymbol> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };

async function startDrill(page: Page, id: string, level = 1) {
  await page.goto(`/train/${id}`);
  await page.getByTestId(`drill-level-${level}`).click();
  await page.getByTestId("drill-start").click();
  await expect(page.getByTestId("drill-running")).toBeVisible();
}

async function promptText(page: Page): Promise<string> {
  const p = page.getByTestId("drill-prompt").last();
  await expect(p).toBeVisible();
  return (await p.textContent()) ?? "";
}

async function expectCorrect(page: Page) {
  await expect(page.getByTestId("drill-feedback")).toHaveAttribute("data-correct", "true");
}

async function endDrill(page: Page) {
  await page.getByRole("button", { name: "End" }).click();
  await expect(page.getByTestId("drill-done")).toBeVisible();
}

function squaresIn(text: string): Square[] {
  return (text.match(/[a-h][1-8]/g) ?? []) as Square[];
}

function knightPath(from: Square, to: Square): Square[] {
  const moves = (sq: Square) => {
    const f = sq.charCodeAt(0) - 97;
    const r = sq.charCodeAt(1) - 49;
    return [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
      .map(([df, dr]) => [f + df!, r + dr!] as const)
      .filter(([a, b]) => a >= 0 && a < 8 && b >= 0 && b < 8)
      .map(([a, b]) => `${String.fromCharCode(97 + a)}${b + 1}` as Square);
  };
  const prev = new Map<Square, Square | null>([[from, null]]);
  const q: Square[] = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const n of moves(cur)) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      q.push(n);
    }
  }
  const path: Square[] = [];
  for (let c: Square | null = to; c; c = prev.get(c) ?? null) path.unshift(c);
  return path;
}

test.describe("training drills", () => {
  test.beforeEach(async ({ page }) => resetStorage(page));

  test("square colour", async ({ page }) => {
    await startDrill(page, "square-color");
    const sq = squaresIn(await promptText(page))[0]!;
    const dark = (sq.charCodeAt(0) - 97 + (sq.charCodeAt(1) - 49)) % 2 === 0;
    await page.getByTestId(dark ? "choice-dark" : "choice-light").click();
    await expectCorrect(page);
    await endDrill(page);
    await expect(page.getByTestId("drill-done")).toContainText("1 of 1 correct");
  });

  test("coordinates — find the square", async ({ page }) => {
    await startDrill(page, "coordinates");
    const sq = squaresIn(await promptText(page))[0]!;
    await clickSquare(page, sq);
    await expectCorrect(page);
    await endDrill(page);
  });

  test("coordinates — name the square", async ({ page }) => {
    await startDrill(page, "coordinates", 3);
    await expect(page.getByTestId("drill-prompt").last()).toContainText("Which square is lit?");
    // The lit square is the only focus mark on the board.
    const sq = (await page.locator('[aria-roledescription="chessboard"] [data-mark="focus"]').first().getAttribute("data-square"))!;
    await page.getByTestId("drill-input").fill(sq);
    await page.getByTestId("drill-submit").click();
    await expectCorrect(page);
  });

  test("knight routes", async ({ page }) => {
    await startDrill(page, "knight-routes", 2);
    const [from, to] = squaresIn(await promptText(page)) as [Square, Square];
    const path = knightPath(from, to);
    await page.getByTestId("drill-input").fill(path.slice(1, -1).join(" "));
    await page.getByTestId("drill-submit").click();
    await expectCorrect(page);
    await page.getByTestId("drill-next").click();
    await expect(page.getByTestId("drill-feedback")).toHaveCount(0);
    await endDrill(page);
  });

  test("diagonals and lines", async ({ page }) => {
    await startDrill(page, "lines");
    const [a, b] = squaresIn(await promptText(page)) as [Square, Square];
    const same = Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) === Math.abs(a.charCodeAt(1) - b.charCodeAt(1));
    await page.getByTestId(same ? "choice-true" : "choice-false").click();
    await expectCorrect(page);
    await endDrill(page);
  });

  test("where's the piece", async ({ page }) => {
    await startDrill(page, "where-piece");
    const moves = page.getByTestId("where-moves");
    await expect(moves).toBeVisible();
    const ucis = ((await moves.getAttribute("data-ucis")) ?? "").split(" ").filter(Boolean);
    const chess = new Chess();
    for (const u of ucis) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    await page.getByTestId("where-ready").click();

    for (let i = 0; i < 3; i++) {
      const text = await promptText(page);
      if (/What is on/.test(text)) {
        const sq = squaresIn(text)[0]!;
        const p = chess.get(sq);
        await page.getByTestId(p ? `pick-${p.color}${p.type}` : "pick-empty").click();
      } else if (/Where is/.test(text)) {
        const m = /(white|black) (\w+)/.exec(text)!;
        const sq = chess.findPiece({ color: m[1] === "white" ? "w" : "b", type: NAMES[m[2]!]! })[0]!;
        await page.getByTestId("drill-input").fill(sq);
        await page.getByTestId("drill-submit").click();
      } else {
        const san = /Is (\S+) legal/.exec(text)![1]!;
        const legal = chess.moves().some((m) => m.replace(/[+#]/g, "") === san.replace(/[+#]/g, ""));
        await page.getByTestId(legal ? "choice-true" : "choice-false").click();
      }
      if (i < 2) await expect(page.getByTestId("drill-prompt").last()).not.toHaveText(text);
    }
    await expectCorrect(page);
  });

  test("memory", async ({ page }) => {
    await startDrill(page, "memory");
    await expect(page.getByTestId("memory-countdown")).toBeVisible();
    const pieces = await page.locator("[data-piece]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-piece")!, e.getAttribute("data-square")!] as const));
    expect(pieces.length).toBe(4);
    await page.getByTestId("memory-ready").click();
    for (const [piece, sq] of pieces) {
      await page.getByTestId(`tool-${piece}`).click();
      await clickSquare(page, sq as Square);
    }
    await page.getByTestId("memory-check").click();
    await expectCorrect(page);
  });

  test("one tap on the Train hub starts a drill", async ({ page }) => {
    await page.goto("/train");
    await page.getByTestId("drill-card-lines").getByRole("link", { name: "Diagonals & lines" }).click();
    await expect(page.getByTestId("drill-running")).toBeVisible();
    await expect(page.getByTestId("drill-prompt").last()).toBeVisible();
  });

  test("a drill remembers its level", async ({ page }) => {
    await startDrill(page, "square-color", 3);
    await endDrill(page);
    await page.goto("/train/square-color");
    await expect(page.getByTestId("drill-level-3")).toHaveAttribute("aria-checked", "true");
    await page.goto("/train");
    await expect(page.getByTestId("drill-card-square-color")).toContainText("Level 3");
  });

  test("drill sessions update the hub", async ({ page }) => {
    await startDrill(page, "square-color", 2);
    const sq = squaresIn(await promptText(page))[0]!;
    const dark = (sq.charCodeAt(0) - 97 + (sq.charCodeAt(1) - 49)) % 2 === 0;
    await page.getByTestId(dark ? "choice-dark" : "choice-light").click();
    await endDrill(page);
    await page.goto("/train");
    await expect(page.getByTestId("drill-card-square-color")).toContainText("best 100%");
  });
});
