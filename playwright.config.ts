import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.local", quiet: true });

const PORT = Number(process.env.PORT ?? 3419);
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const dbUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL = dbUrl; // used by globalSetup

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1, // tests share one database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          DATABASE_URL: dbUrl,
          ADMIN_PASSWORD: "e2e-admin-password",
          SESSION_SECRET: "e2e-session-secret-0123456789abcdef",
          NEXT_PUBLIC_SITE_URL: baseURL,
        },
      },
});
