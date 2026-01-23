import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_DIR = path.join(__dirname, "playwright/.auth");
export const STORAGE_STATE = path.join(STORAGE_STATE_DIR, "user.json");

// Base URLs
const UI_BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// Timeout constants for consistent configuration
const TIMEOUTS = {
  action: 10_000, // Per-action timeout (clicks, fills, etc.)
  navigation: 30_000, // Page navigation timeout
  test: 60_000, // Overall test timeout
  expect: 10_000, // Assertion timeout
  webServer: 120_000, // Dev server startup timeout
} as const;

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["html", { outputFolder: "./playwright-report" }],
    ["list"],
    ...(process.env.CI ? [["github", {}] as const] : []),
  ],

  use: {
    baseURL: UI_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: TIMEOUTS.action,
    navigationTimeout: TIMEOUTS.navigation,
  },

  timeout: TIMEOUTS.test,

  expect: {
    timeout: TIMEOUTS.expect,
  },

  projects: [
    // ===== UI Test Projects =====
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      testMatch: /(?<!\.api)\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      testMatch: /(?<!\.api)\.spec\.ts$/,
      use: {
        ...devices["Desktop Firefox"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      testMatch: /(?<!\.api)\.spec\.ts$/,
      use: {
        ...devices["Desktop Safari"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },

    // ===== API Test Projects =====
    {
      name: "api",
      testMatch: /\.api\.spec\.ts$/,
      use: {
        baseURL: API_BASE_URL,
        extraHTTPHeaders: {
          Accept: "application/json",
        },
      },
      // API tests don't need browser setup
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: "VITE_ENABLE_TEST_IDS=true npm run dev",
        cwd: "../frontend",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: TIMEOUTS.webServer,
      },
});
