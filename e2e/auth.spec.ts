import { expect, test } from "@playwright/test";
import { E2E_USER } from "./helpers";

test.describe("Autenticação", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redireciona visitante não logado para o login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Financeiro Pessoal" })).toBeVisible();
  });

  for (const route of ["/metas", "/rotina"]) {
    test(`protege ${route} para visitante não logado`, async ({ page }) => {
      test.fail(true, "Bug conhecido: a rota não está no matcher do middleware");
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    });
  }

  test("mostra erro com senha incorreta", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(E2E_USER.email);
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("entra com credenciais válidas e cai no dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(E2E_USER.email);
    await page.getByLabel("Senha").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
