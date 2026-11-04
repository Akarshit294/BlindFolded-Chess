import { expect, test } from "@playwright/test";
import { resetStorage } from "./helpers";

test("imports and exports progress", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/stats");
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  const now = Date.now();
  const data = {
    app: "blindfold-chess",
    version: 1,
    exportedAt: new Date(now).toISOString(),
    games: [
      {
        id: "g1",
        config: { playerColor: "w", levelId: 1, visibility: "blind", mode: "practice", timeControl: null, peeks: 3, moveList: "hidden" },
        startedAt: now - 3_600_000,
        updatedAt: now - 3_500_000,
        moves: ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"],
        sans: ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"],
        moveTimes: [4000, 1000, 5000, 1000, 6000, 1000, 3000],
        clocks: null,
        peeksUsed: 1,
        illegalAttempts: 0,
        takebacks: 0,
        result: { winner: "w", reason: "checkmate" },
        endedAt: now - 3_500_000,
      },
    ],
    sessions: [
      { id: "s1", drill: "square-color", level: 1, timed: false, startedAt: now - 86_400_000, durationMs: 60_000, correct: 18, total: 20, accuracy: 0.9, bestStreak: 9, ratingAfter: 1234 },
      { id: "s2", drill: "square-color", level: 1, timed: false, startedAt: now, durationMs: 60_000, correct: 20, total: 20, accuracy: 1, bestStreak: 20, ratingAfter: 1260 },
    ],
    puzzles: [{ id: "p1", puzzleId: "x", puzzleRating: 1300, goal: "mate1", solved: true, firstTry: true, mistakes: 0, peeks: 0, timeMs: 20_000, ts: now, ratingAfter: 1225 }],
    ratings: { blindfold: { rating: 1200, played: 0, peak: 1200 }, puzzles: { rating: 1225, played: 1, peak: 1225 }, drills: { "square-color": { rating: 1260, played: 2, peak: 1260 } } },
  };
  await page.getByTestId("import-file").setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByTestId("import-merge").click();
  await expect(page.getByTestId("import-message")).toContainText("Imported 1 game, 2 drill sessions and 1 puzzle attempt.");
  await expect(page.getByTestId("drill-table")).toContainText("1260");
  await expect(page.getByText("Current streak").first()).toBeVisible();

  // The replay is loaded on demand: open it, step through and close it.
  await expect(page.getByTestId("games-table")).toContainText("Won");
  await page.getByTestId("games-table").getByRole("button", { name: "Replay" }).click();
  const dialog = page.getByRole("dialog", { name: /Checkmate\. You win\. vs/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Last move" }).click();
  await expect(dialog.getByLabel("Replay position after ply 7")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const download = page.waitForEvent("download");
  await page.getByTestId("export").click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/blindfold-progress-\d{4}-\d{2}-\d{2}\.json/);
});
