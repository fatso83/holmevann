const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  globalSetup: require.resolve("./global-setup"),
  testDir: ".",
  testMatch: ["offline-pdf.spec.js"],
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8888",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
