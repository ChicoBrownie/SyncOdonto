import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/mobile", testMatch: "**/*.pw.ts", fullyParallel: false, workers: 1,
  timeout: 60_000, expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:3100", channel: "chrome", headless: true, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  webServer: { command: "node tests/mobile/server.mjs", url: "http://127.0.0.1:3100/auth/login", timeout: 180_000, reuseExistingServer: true },
})
