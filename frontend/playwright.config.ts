import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  // Tests share a single backend + the seeded "user" account/board, so run
  // serially to avoid cross-test database contention.
  workers: 1,
  fullyParallel: false,
  expect: {
    timeout: 10_000,
  },
  globalSetup: "./tests/global.setup.ts",
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "py -m uvicorn backend.main:app --port 8000",
    cwd: path.resolve(__dirname, ".."),
    url: "http://127.0.0.1:8000/health",
    reuseExistingServer: true,
    timeout: 30_000,
    // Disable per-IP rate limiting so the serial suite's repeated logins
    // don't trip the 10/min limit.
    env: { ...process.env, DISABLE_RATE_LIMIT: "1" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
