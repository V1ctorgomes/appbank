import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://e2e:e2e@localhost:5544/appbank_e2e?schema=public";

// O Next e o Prisma não sobrescrevem variáveis já definidas no processo,
// então isso garante que o `.env` (que aponta para produção) seja ignorado.
const serverEnv = {
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_SECRET: "e2e-secret-not-for-production-0123456789",
  AUTH_URL: BASE_URL,
  AUTH_TRUST_HOST: "true",
  PORTAL_USER_ID: "",
  VERCEL: "",
  VERCEL_ENV: "",
  NEXT_TELEMETRY_DISABLED: "1",
};

Object.assign(process.env, serverEnv);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${BASE_URL}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: serverEnv,
    stdout: "ignore",
    stderr: "pipe",
  },
});
