import { expect, test } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";

const PAGES: Array<[string, RegExp]> = [
  ["/", /Close your eyes/],
  ["/play", /Play blindfolded/],
  ["/train", /Train your/],
  ["/puzzles", /Blindfold puzzles/],
  ["/stats", /Your progress/],
  ["/learn", /How to see/],
  ["/settings", /Settings/],
  ["/credits", /Credits/],
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
});

test("keyboard users can skip to content", async ({ page }) => {
  await page.goto("/learn");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
