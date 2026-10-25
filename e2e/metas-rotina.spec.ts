import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Metas", () => {
  test("cria uma meta manual e ela aparece na lista", async ({ page }) => {
    const title = `Meta E2E ${uniqueSuffix()}`;
    await page.goto("/metas");
    await page.getByRole("button", { name: /Nova Meta/ }).click();
    await page.getByLabel("Tipo de Meta").selectOption("MANUAL_CHECKLIST");
    await page.getByPlaceholder("Ex: Organizar recibos dos clientes").fill(title);
    await page.getByRole("button", { name: /Criar|Salvar/ }).last().click();
    await expect(page.getByText(title)).toBeVisible();
  });
});

test.describe("Rotina", () => {
  test("cria uma rotina recorrente e ela aparece no dia", async ({ page }) => {
    const title = `Rotina E2E ${uniqueSuffix()}`;
    await page.goto("/rotina");
    await page.getByRole("button", { name: /Nova Rotina/ }).first().click();
    await page.getByPlaceholder(/Ex: Treino/).fill(title);
    await page.getByRole("button", { name: "Criar Rotina" }).click();
    await expect(page.getByText(title).first()).toBeVisible();
  });
});
