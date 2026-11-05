import { expect, test, type Page } from "@playwright/test";
import { movesPlayed, resetStorage, trackConsoleErrors, waitForPlayerTurnOrEnd } from "./helpers";

/**
 * The redesign's flow: home to a live game in one click, the first move starts it, the game ends in place with
 * the review on the same board, Play again keeps the setup, and a game in progress is one click from home.
 */

async function typeMove(page: Page, san: string) {
  await waitForPlayerTurnOrEnd(page);
  const before = (await movesPlayed(page)).length;
  const input = page.getByTestId("move-input");
  await input.fill(san);
  await input.press("Enter");
  // The engine answers: two plies further on, or the game is over.
  await page.waitForFunction(
    (n) => {
      const s = (window as unknown as { __bf?: { moves: string[]; result: unknown } }).__bf;
      return !!s && (s.result || s.moves.length >= n + 2);
    },
    before,
    { timeout: 20_000 },
  );
}

test.describe("play-first flow", () => {
  test.beforeEach(async ({ page }) => resetStorage(page));

  test("home to a live game in one click, with the default setup", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/?e2e=1");
    await expect(page.getByTestId("setup-summary")).toContainText(/Ghost/i);
    await page.getByTestId("play-now").click();

    // One click later the game is waiting for the first move: no setup screen in between.
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("move-input")).toBeVisible();
    const quick = page.getByTestId("quick-setup");
    await expect(quick.getByTestId("visibility-ghost")).toHaveAttribute("aria-checked", "true");
    await expect(quick.getByTestId("level-2")).toHaveAttribute("aria-checked", "true");

    // The first move is the start.
    await typeMove(page, "e4");
    const s = await waitForPlayerTurnOrEnd(page);
    expect(s.moves[0]).toBe("e2e4");
    expect(s.moves.length).toBe(2);
    await expect(page.getByTestId("move-list")).toContainText("e4");
    expect(errors).toEqual([]);
  });

  test("/play starts a game straight away and a click on the board plays the first move", async ({ page }) => {
    await page.goto("/play?e2e=1");
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("start-game")).toHaveCount(0);
    const s0 = await waitForPlayerTurnOrEnd(page);
    expect(s0.moves).toEqual([]);
    const box = (await page.locator('[aria-roledescription="chessboard"]').first().boundingBox())!;
    const sq = box.width / 8;
    // e2 then e4 (white at the bottom).
    await page.mouse.click(box.x + 4.5 * sq, box.y + 6.5 * sq);
    await page.mouse.click(box.x + 4.5 * sq, box.y + 4.5 * sq);
    await page.waitForFunction(() => ((window as unknown as { __bf?: { moves: string[] } }).__bf?.moves.length ?? 0) >= 2, null, {
      timeout: 20_000,
    });
    expect((await movesPlayed(page))[0]).toBe("e2e4");
  });

  test("a mode card starts that mode; the game ends in place and Play again keeps the setup", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.getByTestId("mode-card-silhouette").click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("quick-setup").getByTestId("visibility-silhouette")).toHaveAttribute("aria-checked", "true");

    await typeMove(page, "e4");
    await typeMove(page, "Nf3");
    const firstId = await page.evaluate(() => JSON.parse(localStorage.getItem("bf:game") ?? "{}")?.state?.game?.id ?? null);
    await page.getByTestId("resign").click();
    await page.getByTestId("confirm-resign").click();

    // Game over appears on the same page, beside the board, with the review.
    await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("result-title")).toHaveAccessibleName("You lost.");
    await expect(page.getByTestId("game-over")).toContainText(/resign/i);
    await expect(page.locator('[aria-roledescription="chessboard"]').first()).toBeVisible();
    await expect(page.getByTestId("review")).toBeVisible({ timeout: 30_000 });

    // One click: a new game with the same setup.
    await page.getByTestId("rematch").click();
    await expect(page.getByTestId("game-over")).toHaveCount(0);
    await expect(page.getByTestId("quick-setup").getByTestId("visibility-silhouette")).toHaveAttribute("aria-checked", "true");
    const s = await waitForPlayerTurnOrEnd(page);
    expect(s.moves).toEqual([]);
    expect(s.result).toBeFalsy();
    const secondId = await page.evaluate(() => JSON.parse(localStorage.getItem("bf:game") ?? "{}")?.state?.game?.id ?? null);
    expect(secondId).not.toBe(firstId);

    // The home page remembers the setup for next time too.
    await page.goto("/");
    await expect(page.getByTestId("setup-summary")).toContainText(/Silhouette/i);
  });

  test("a game in progress continues from home in one click", async ({ page }) => {
    await page.goto("/play?e2e=1");
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await typeMove(page, "d4");
    await typeMove(page, "c4");
    const before = await movesPlayed(page);
    expect(before.length).toBe(4);

    await page.goto("/");
    await expect(page.getByTestId("continue-game")).toBeVisible();
    await expect(page.getByTestId("setup-summary")).toContainText("Move 3");
    await page.getByTestId("continue-game").click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("game-screen")).toBeVisible();
    const after = await waitForPlayerTurnOrEnd(page);
    expect(after.moves).toEqual(before);
    await expect(page.getByTestId("move-list")).toContainText("c4");

    // From home, New game replaces it with a fresh one.
    await page.goto("/");
    await page.getByTestId("play-now").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();
    const fresh = await waitForPlayerTurnOrEnd(page);
    expect(fresh.moves).toEqual([]);
  });

  test("Change on the home page edits the setup and plays it", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.getByTestId("change-setup").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("visibility-blind").click();
    await dialog.getByTestId("level-1").click();
    await dialog.getByTestId("setup-play").click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("blind-panel")).toBeVisible();
    // The dialog closed on the way (a cached copy of the home page may keep it, hidden).
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByTestId("quick-setup").getByTestId("level-1")).toHaveAttribute("aria-checked", "true");
  });
});
