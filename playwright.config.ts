import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_PATH: "./data/e2e-test.db",
      SESSION_SECRET: "e2e-test-session-secret-at-least-32-characters",
      APP_URL: `http://localhost:${PORT}`,
      E2E_TEST_MODE: "true",
      E2E_MAIL_LOG_PATH: "./data/e2e-mail.log",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
