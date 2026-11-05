import { expect, test } from "@playwright/test";
import { resetStorage } from "./helpers";

test("settings persist across reloads", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/settings");
  await page.getByTestId("theme-walnut").click();
  await page.getByTestId("pieces-cburnett").click();
  await page.getByRole("switch", { name: /Show coordinates/ }).uncheck({ force: true });
  await page.getByRole("radio", { name: "Reduced" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-board-theme", "walnut");

  await page.reload();
  await expect(page.getByTestId("theme-walnut")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("pieces-cburnett")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: /Show coordinates/ })).not.toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-board-theme", "walnut");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");

  await page.getByTestId("reset-settings").click();
  await expect(page.getByTestId("theme-nocturne")).toHaveAttribute("aria-checked", "true");
});
