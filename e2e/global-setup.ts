import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E_USER } from "./helpers";

export default async function globalSetup(config: FullConfig) {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const host = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1"].includes(host) || !databaseUrl.includes("e2e")) {
    throw new Error(
      `Recusando rodar E2E fora de um banco local de teste (host atual: ${host}).`
    );
  }

  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const password = await bcrypt.hash(E2E_USER.password, 10);
  await prisma.user.upsert({
    where: { email: E2E_USER.email },
    update: { password },
    create: { name: E2E_USER.name, email: E2E_USER.email, password },
  });
  await prisma.$disconnect();

  const baseURL = config.projects[0].use.baseURL!;
  const storagePath = path.join(__dirname, ".auth", "user.json");
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("E-mail").fill(E2E_USER.email);
  await page.getByLabel("Senha").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard", { timeout: 120_000 });
  await page.context().storageState({ path: storagePath });
  await browser.close();
}
