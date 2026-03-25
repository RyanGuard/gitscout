import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/qa",
  outputDir: "./qa-reports/test-results",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 3,
  timeout: 60000,
  reporter: [
    ["list"],
    ["json", { outputFile: "./qa-reports/results.json" }],
  ],
  use: {
    baseURL: process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app",
    headless: true,
    screenshot: "only-on-failure",
  },
});
