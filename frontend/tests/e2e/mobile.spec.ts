import { devices, expect, test } from "@playwright/test";
import { resetStorage, waitForPlayerTurnOrEnd } from "./helpers";

const { defaultBrowserType: _ignored, ...pixel } = devices["Pixel 7"];
test.use({ ...pixel });

test("touch drag plays a move on a phone", async ({ page, context }) => {
  await resetStorage(page);
  await page.goto("/play?e2e=1");
  await page.getByTestId("visibility-full").click();
  await expect(page.getByTestId("visibility-full")).toHaveAttribute("aria-checked", "true");
  await waitForPlayerTurnOrEnd(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = (await page.locator('[aria-roledescription="chessboard"]').boundingBox())!;
  const sq = box.width / 8;
  const at = (file: number, rank: number) => ({ x: box.x + (file + 0.5) * sq, y: box.y + (7 - rank + 0.5) * sq });
  const from = at(4, 1);
  const to = at(4, 3);
  const cdp = await context.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", p?: { x: number; y: number }) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  await touch("touchStart", from);
  for (let i = 1; i <= 8; i++) await touch("touchMove", { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
  await touch("touchEnd");
  await page.waitForFunction(() => ((window as unknown as { __bf?: { moves: string[] } }).__bf?.moves.length ?? 0) >= 1);
  const moves = await page.evaluate(() => (window as unknown as { __bf: { moves: string[] } }).__bf.moves);
  expect(moves[0]).toBe("e2e4");
});

test("the move bar replaces the dock during a game, above everything else", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/");
  // The dock is there on ordinary pages...
  await expect(page.getByRole("navigation", { name: "Main" }).last()).toBeVisible();
  await page.getByTestId("play-now").click();
  await expect(page.getByTestId("game-screen")).toBeVisible();
  // ...and gives way to the move bar in a game.
  const bar = page.getByTestId("move-bar");
  await expect(bar).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  const box = (await bar.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y + box.height).toBeGreaterThan(vh - 40);
  await expect(bar.getByTestId("move-input")).toBeVisible();
  await expect(bar.getByTestId("peek")).toBeVisible();
});

for (const path of ["/", "/play", "/train", "/puzzles", "/stats", "/learn", "/settings", "/credits", "/train/memory"]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
