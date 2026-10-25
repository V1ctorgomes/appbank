import { expect, test } from "@playwright/test";
import { createClientViaUi, formatCpf, generateCpf, todayInput, uniqueSuffix } from "./helpers";

test.describe("Portal público de consulta por CPF", () => {
  test("cliente com venda em aberto vê suas parcelas sem login", async ({ page, browser }) => {
    const { name, cpf } = await createClientViaUi(page, `Portal ${uniqueSuffix()}`);

    await page.goto("/vendas/nova");
    await page.getByLabel("Cliente *").selectOption({ label: name });
    await page.getByRole("button", { name: "Valor Direto" }).click();
    await page.getByLabel("Descrição *").fill("Compra portal");
    await page.getByLabel("Valor Total *").fill("90");
    await page.getByRole("button", { name: "Parcelada" }).click();
    await page.getByLabel("Quantidade de Parcelas *").fill("3");
    await page.getByLabel("Primeiro Vencimento *").fill(todayInput());
    await page.getByRole("button", { name: "Registrar Venda" }).click();
    await expect(page).toHaveURL(/\/vendas\/[^/]+$/);

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const portal = await visitor.newPage();
    await portal.goto("/consulta");
    await portal.getByLabel("CPF").fill(cpf);
    await expect(portal.getByLabel("CPF")).toHaveValue(formatCpf(cpf));
    await portal.getByRole("button", { name: "Consultar" }).click();

    await expect(portal.getByText(name).first()).toBeVisible();
    await expect(portal.getByText("Compra portal").first()).toBeVisible();
    await visitor.close();
  });

  test("CPF inválido e CPF inexistente mostram mensagens claras", async ({ browser }) => {
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const portal = await visitor.newPage();
    await portal.goto("/consulta");

    await portal.getByLabel("CPF").fill("12345678900");
    await portal.getByRole("button", { name: "Consultar" }).click();
    await expect(portal.getByText(/CPF inválido/)).toBeVisible();

    await portal.getByLabel("CPF").fill(generateCpf());
    await portal.getByRole("button", { name: "Consultar" }).click();
    await expect(portal.getByText("CPF não encontrado em nossa base.")).toBeVisible();
    await visitor.close();
  });
});
