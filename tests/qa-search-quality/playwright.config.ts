import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: "../../qa-reports/search-deep-dive/test-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app",
    headless: true,
  },
});
