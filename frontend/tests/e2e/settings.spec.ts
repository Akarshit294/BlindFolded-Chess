import { expect, test } from "@playwright/test";
import { resetStorage } from "./helpers";

test("settings persist across reloads", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/settings");
  await page.getByTestId("theme-graphite").click();
  await page.getByTestId("pieces-cburnett").click();
  await page.getByRole("switch", { name: /Show coordinates/ }).uncheck({ force: true });
  await page.getByRole("radio", { name: "Reduced" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-board-theme", "graphite");

  await page.reload();
  await expect(page.getByTestId("theme-graphite")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("pieces-cburnett")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: /Show coordinates/ })).not.toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-board-theme", "graphite");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");

  await page.getByTestId("reset-settings").click();
  await expect(page.getByTestId("theme-studio")).toHaveAttribute("aria-checked", "true");
});

test("light and dark themes apply at once and before the first paint", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/settings");
  await page.getByTestId("ui-theme-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // The boot script sets the theme before React loads: no light flash on reload.
  await page.reload({ waitUntil: "commit" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("ui-theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("a board theme saved before the redesign still loads", async ({ page }) => {
  await resetStorage(page);
  await page.evaluate(() => localStorage.setItem("bf:settings", JSON.stringify({ state: { boardTheme: "walnut", pieceSet: "lumen" }, version: 1 })));
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-board-theme", "graphite");
  await expect(page.getByTestId("theme-graphite")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("pieces-gloss")).toHaveAttribute("aria-checked", "true");
});
