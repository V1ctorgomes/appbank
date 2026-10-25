import { expect, test, type Page } from "@playwright/test";
import { acceptDialogs, uniqueSuffix } from "./helpers";

async function createTransaction(
  page: Page,
  type: "Entrada" | "Saída",
  description: string,
  value: number
) {
  await page.getByRole("button", { name: "Nova Movimentação" }).click();
  await page.getByRole("button", { name: type, exact: true }).click();
  await page.getByLabel("Descrição *").fill(description);
  await page.getByLabel("Valor *").fill(String(value));
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByRole("heading", { name: "Nova Movimentação" })).toHaveCount(0);
}

test.describe("Movimentações", () => {
  test("registra entrada e saída e exclui", async ({ page }) => {
    acceptDialogs(page);
    const suffix = uniqueSuffix();
    const income = `Entrada E2E ${suffix}`;
    const expense = `Saída E2E ${suffix}`;

    await page.goto("/movimentacoes");
    await createTransaction(page, "Entrada", income, 500);
    await createTransaction(page, "Saída", expense, 200);

    const incomeRow = page.locator("tr", { hasText: income });
    const expenseRow = page.locator("tr", { hasText: expense });
    await expect(incomeRow).toContainText("+R$ 500,00");
    await expect(expenseRow).toContainText("-R$ 200,00");

    await expenseRow.getByRole("button", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText(expense)).toHaveCount(0);
    await expect(page.getByText(income)).toBeVisible();
  });

  test("editar a descrição não altera a data", async ({ page }) => {
    test.fail(
      true,
      "Bug conhecido: a página formata tx.date (meia-noite UTC) no fuso UTC-3 e o modal reenvia o dia anterior"
    );
    const description = `Edição E2E ${uniqueSuffix()}`;
    await page.goto("/movimentacoes");
    await createTransaction(page, "Saída", description, 50);

    const row = page.locator("tr", { hasText: description });
    const originalDate = (await row.locator("td").first().textContent())?.trim();

    await row.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Descrição *").fill(`${description} editada`);
    await page.getByRole("button", { name: "Salvar" }).click();

    const edited = page.locator("tr", { hasText: `${description} editada` });
    await expect(edited.locator("td").first()).toHaveText(originalDate!, { timeout: 5_000 });
  });
});
