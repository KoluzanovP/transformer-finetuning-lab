import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke-тесты интерфейса.
 * Предполагается, что API (:4000) и web (:3000) уже запущены и dev-БД
 * заполнена демо-данными (pnpm --filter @edu/api seed).
 * Путь к Chromium берётся из PW_CHROMIUM (в этом окружении — предустановлен).
 */
export default defineConfig({
  testDir: "./e2e-ui",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3000",
    headless: true,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
