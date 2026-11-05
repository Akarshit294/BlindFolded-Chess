import { expect, test } from "@playwright/test";
import { playUntilGameOver, resetStorage, startGame, trackConsoleErrors, waitForPlayerTurnOrEnd } from "./helpers";

test.describe("blindfold game vs Stockfish", () => {
  test.beforeEach(async ({ page }) => resetStorage(page));

  for (const [visibility, how] of [
    ["full", "click"],
    ["ghost", "type"],
    ["silhouette", "type"],
    ["empty", "click"],
    ["blind", "type"],
  ] as const) {
    test(`plays a full game in ${visibility} mode (${how} input)`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      await startGame(page, { visibility });
      if (visibility === "blind") await expect(page.getByTestId("blind-panel")).toBeVisible();
      const end = await playUntilGameOver(page, how, visibility.length);
      expect(end.result).toBeTruthy();
      await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("result-title")).not.toBeEmpty();
      await expect(page.getByTestId("stat-peeks")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("counts illegal attempts and peeks, and resigns", async ({ page }) => {
    await startGame(page, { visibility: "ghost", level: 1 });
    await waitForPlayerTurnOrEnd(page);
    const input = page.getByTestId("move-input");
    await input.fill("Ke4");
    await input.press("Enter");
    await expect(page.getByTestId("illegal-count")).toContainText("1");
    await page.getByTestId("peek").click();
    await expect(page.getByText("Peeking…")).toBeVisible();
    await page.getByTestId("resign").click();
    await page.getByTestId("confirm-resign").click();
    await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("stat-peeks")).toContainText("1");
    await expect(page.getByTestId("stat-illegal")).toContainText("1");
  });

  test("restores the game in progress after a refresh", async ({ page }) => {
    await startGame(page, { visibility: "silhouette", level: 2 });
    const input = page.getByTestId("move-input");
    for (const mv of ["e4", "Nf3"]) {
      await waitForPlayerTurnOrEnd(page);
      await input.fill(mv);
      await input.press("Enter");
    }
    const before = await waitForPlayerTurnOrEnd(page);
    await page.reload();
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByText("Game restored")).toBeVisible();
    const after = await waitForPlayerTurnOrEnd(page);
    expect(after.moves).toEqual(before.moves);
    await expect(page.getByTestId("move-list")).toContainText("Nf3");
  });

  test("takes a move back and shows the clock", async ({ page }) => {
    await page.goto("/play?e2e=1");
    await page.getByTestId("visibility-full").click();
    await page.getByTestId("level-1").click();
    await page.getByRole("radio", { name: "5+3" }).click();
    await page.getByTestId("start-game").click();
    await expect(page.getByTestId("clock-you")).toBeVisible();
    const input = page.getByTestId("move-input");
    await waitForPlayerTurnOrEnd(page);
    await input.fill("e4");
    await input.press("Enter");
    await waitForPlayerTurnOrEnd(page);
    await page.getByTestId("takeback").click();
    const s = await waitForPlayerTurnOrEnd(page);
    expect(s.moves).toEqual([]);
  });
});
