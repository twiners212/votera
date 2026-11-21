import fs from "node:fs";
import { defineConfig, chromium } from "@playwright/test";

if (
  typeof (process as unknown as { loadEnvFile?: (path?: string) => void })
    .loadEnvFile === "function"
) {
  try {
    (
      process as unknown as { loadEnvFile: (path?: string) => void }
    ).loadEnvFile(".env.local");
  } catch {
    // Ignore if .env.local is absent
  }
}

const hasBundledChromium = fs.existsSync(chromium.executablePath());

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    ...(hasBundledChromium ? {} : { channel: "msedge" }),
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec next start -H localhost -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      BETTER_AUTH_URL: "http://localhost:3100",
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
    },
  },
});
