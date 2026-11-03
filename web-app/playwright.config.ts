import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

// End-to-end tests run headless against a production build (next build +
// next start) with its own throwaway data in .e2e-data/ (database, uploads,
// saved emails), so they never touch your normal local data. This works while
// `npm run dev` is running, because dev and build use separate output folders.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node e2e/reset-data.mjs && next build && next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      APP_URL: `http://localhost:${PORT}`,
      PGLITE_DIR: ".e2e-data/db",
      UPLOAD_DIR: ".e2e-data/uploads",
      MAIL_DIR: ".e2e-data/mail",
      SMTP_URL: "",
      DATABASE_URL: "",
      DIGEST_POLL_MS: "1000",
      // The tests cover every admin section, including ones hidden for now (lib/sections.ts).
      ADMIN_HIDDEN_SECTIONS: "",
    },
  },
});
