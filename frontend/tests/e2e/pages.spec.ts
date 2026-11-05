import { expect, test } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";

const PAGES: Array<[string, RegExp]> = [
  ["/", /Blindfold chess/],
  ["/play", /Play blindfold chess/],
  ["/train", /Train your vision/],
  ["/train/memory", /Position memory/],
  ["/puzzles", /Blindfold puzzles/],
  ["/stats", /Your progress/],
  ["/learn", /See without looking/],
  ["/settings", /Your settings/],
  ["/credits", /Open credits/],
];

for (const [path, heading] of PAGES) {
  test(`renders ${path} without errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
}

test("navigation and 404", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Train" }).click();
  await expect(page).toHaveURL(/\/train$/);
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("This square is empty");
  await page.getByRole("link", { name: "Back to the start" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("keyboard users can skip to content", async ({ page }) => {
  await page.goto("/learn");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
