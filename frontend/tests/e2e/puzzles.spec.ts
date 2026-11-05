import { expect, test, type Page } from "@playwright/test";
import { resetStorage } from "./helpers";

type P = { id: string; moves: string[] };

/** The puzzle on screen, looked up from the same data the page used (server or bundled file). */
async function currentPuzzle(page: Page): Promise<P> {
  const id = (await page.getByTestId("puzzle").getAttribute("data-puzzle-id"))!;
  const api = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8100}`;
  const p = await page.evaluate(
    async ([pid, base]) => {
      const local = (await (await fetch("/data/puzzles.json")).json()) as { puzzles: P[] };
      const hit = local.puzzles.find((x) => x.id === pid);
      if (hit) return hit;
      const r = await fetch(`${base}/api/puzzles/${pid}`).catch(() => null);
      return r && r.ok ? ((await r.json()) as P) : null;
    },
    [id, api] as const,
  );
  expect(p, "puzzle data should come from the bundle or the API").not.toBeNull();
  return p!;
}

test.describe("puzzles", () => {
  test.beforeEach(async ({ page }) => resetStorage(page));

  test("solves a puzzle described only in text", async ({ page }) => {
    await page.goto("/puzzles");
    const card = page.getByTestId("puzzle");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("puzzle-position")).toContainText("White:".replace(":", ""));
    const p = await currentPuzzle(page);
    const input = page.getByTestId("move-input");
    for (let i = 1; i < p.moves.length; i += 2) {
      await expect(input).toBeEnabled();
      await input.fill(p.moves[i]!);
      await input.press("Enter");
      if (i + 2 < p.moves.length) await expect(page.getByTestId("puzzle-message")).toContainText("Your move");
    }
    await expect(page.getByTestId("puzzle-solved")).toBeVisible();
    await expect(page.getByTestId("puzzle-next")).toBeVisible();
  });

  test("a reply still on its way never lands in the next puzzle", async ({ page }) => {
    await page.goto("/puzzles");
    await page.getByRole("radio", { name: "M2" }).click();
    const card = page.getByTestId("puzzle");
    await expect(card).toBeVisible();
    const first = await currentPuzzle(page);
    const input = page.getByTestId("move-input");
    await input.fill(first.moves[1]!);
    await input.press("Enter");
    // While the opponent replies (half a second), the solver can't act. Checked inside the page, every frame, so
    // a busy machine can't miss the window between two separate assertions.
    await page.waitForFunction(
      () => {
        const i = document.querySelector<HTMLInputElement>('[data-testid="move-input"]');
        const g = document.querySelector<HTMLButtonElement>('[data-testid="puzzle-giveup"]');
        return !!i?.disabled && !!g?.disabled;
      },
      null,
      { polling: "raf", timeout: 5_000 },
    );
    // ...and switching puzzles drops the pending reply.
    await page.getByRole("radio", { name: "M3" }).click();
    await expect(card).not.toHaveAttribute("data-puzzle-id", first.id);
    await page.waitForTimeout(800);
    const second = await currentPuzzle(page);
    await expect(input).toBeEnabled();
    await input.fill(second.moves[1]!);
    await input.press("Enter");
    await expect(page.getByTestId("puzzle-message")).toContainText("Your move");
  });

  test("a wrong answer is counted and the solution can be revealed", async ({ page }) => {
    await page.goto("/puzzles");
    await expect(page.getByTestId("puzzle")).toBeVisible();
    await page.getByTestId("puzzle-hint").click();
    await expect(page.getByTestId("puzzle-message")).toContainText(/Look/);
    await page.getByTestId("puzzle-giveup").click();
    await expect(page.getByTestId("puzzle-message")).toContainText("Solution:");
    await page.getByTestId("puzzle-next").click();
    await expect(page.getByTestId("puzzle")).toBeVisible();
  });
});

test.describe("backend down", () => {
  test("falls back to bundled puzzles and local drills", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort());
    await resetStorage(page);
    await page.goto("/puzzles");
    await expect(page.getByTestId("puzzle")).toBeVisible();
    await expect(page.getByText("Offline set")).toBeVisible();
    await expect(page.getByTestId("backend-status")).toHaveAttribute("data-state", /offline|disabled/);
    await page.goto("/train/where-piece");
    await page.getByTestId("drill-start").click();
    await expect(page.getByTestId("where-moves")).toBeVisible();
  });
});

test.describe("backend up", () => {
  test.skip(process.env.E2E_BACKEND !== "1", "run with E2E_BACKEND=1 to start the API");
  test("uses the API when it is online", async ({ page }) => {
    await resetStorage(page);
    await page.goto("/puzzles");
    await expect(page.getByTestId("backend-status")).toHaveAttribute("data-state", "online", { timeout: 30_000 });
    await page.getByRole("radio", { name: "M1" }).click();
    await expect(page.getByTestId("puzzle")).toBeVisible();
    await expect(page.getByText("Offline set")).toHaveCount(0);
  });
});
