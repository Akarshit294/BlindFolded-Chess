import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8100);
// E2E_BACKEND=1 also starts the FastAPI backend (needs uv). Without it the API URL points at a
// closed port, which exercises the offline fallbacks.
const withBackend = process.env.E2E_BACKEND === "1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // In sandboxes with a pre-installed browser for another Playwright version.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    ...(withBackend
      ? [
          {
            command: `uv run uvicorn app.main:app --port ${API_PORT}`,
            cwd: "../backend",
            url: `http://127.0.0.1:${API_PORT}/api/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
    {
      command: `npm run build && npx next start -p ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`, NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
