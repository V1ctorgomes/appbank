import { expect, test, type Page } from "@playwright/test";
import { acceptDialogs, brl, createClientViaUi, todayInput, uniqueSuffix } from "./helpers";

async function createInstallmentSale(page: Page, clientName: string, total: number, count: number) {
  await page.goto("/vendas/nova");
  await page.getByLabel("Cliente *").selectOption({ label: clientName });
  await page.getByRole("button", { name: "Valor Direto" }).click();
  await page.getByLabel("Descrição *").fill("Serviço E2E");
  await page.getByLabel("Valor Total *").fill(String(total));
  await page.getByRole("button", { name: "Parcelada" }).click();
  await page.getByLabel("Quantidade de Parcelas *").fill(String(count));
  await page.getByLabel("Primeiro Vencimento *").fill(todayInput());
  await expect(page.getByText(`Parcela ${count} —`)).toBeVisible();
  await page.getByRole("button", { name: "Registrar Venda" }).click();
  await expect(page).toHaveURL(/\/vendas\/[^/]+$/);
}

function installmentRow(page: Page, number: number) {
  return page
    .locator("tbody tr")
    .filter({ has: page.locator("td").first().getByText(String(number), { exact: true }) });
}

async function payInstallment(page: Page, number: number) {
  const row = installmentRow(page, number);
  await row.getByRole("button", { name: "Receber" }).click();
  await expect(page.getByRole("heading", { name: "Registrar Recebimento" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar Recebimento" }).click();
}

test.describe("Vendas e recebimentos", () => {
  test("cria venda parcelada, recebe uma parcela e gera movimentação", async ({ page }) => {
    const { name } = await createClientViaUi(page, `Venda ${uniqueSuffix()}`);
    await createInstallmentSale(page, name, 300, 3);

    await expect(page.getByText(brl(300)).first()).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expect(installmentRow(page, 1)).toContainText(brl(100));

    await payInstallment(page, 1);
    await expect(installmentRow(page, 1)).toContainText("Pago");
    await expect(installmentRow(page, 2)).not.toContainText("Pago");

    await page.goto("/movimentacoes");
    await expect(page.getByText(`Recebimento - ${name} - Parcela 1`)).toBeVisible();
  });

  test("a soma de parcelas manuais precisa bater com o total", async ({ page }) => {
    const { name } = await createClientViaUi(page, `Manual ${uniqueSuffix()}`);
    await page.goto("/vendas/nova");
    await page.getByLabel("Cliente *").selectOption({ label: name });
    await page.getByRole("button", { name: "Valor Direto" }).click();
    await page.getByLabel("Descrição *").fill("Venda manual");
    await page.getByLabel("Valor Total *").fill("200");
    await page.getByRole("button", { name: "Parcelada" }).click();
    await page.getByRole("button", { name: "Manual" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("150");
    await page.getByLabel("Vencimento", { exact: true }).fill(todayInput());
    await expect(page.getByText(/difere do total/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Venda" })).toBeDisabled();
  });

  test("parcela que vence hoje continua pendente depois de um estorno", async ({ page }) => {
    test.fail(
      true,
      "Bug conhecido: cancelPayment compara dueDate (meia-noite UTC) com a meia-noite local (UTC-3) e marca como OVERDUE"
    );
    acceptDialogs(page);
    const { name } = await createClientViaUi(page, `Hoje ${uniqueSuffix()}`);
    await createInstallmentSale(page, name, 100, 1);
    await expect(installmentRow(page, 1)).toContainText("Pendente");

    await payInstallment(page, 1);
    await expect(installmentRow(page, 1)).toContainText("Pago");
    await installmentRow(page, 1).getByRole("button", { name: "Estornar" }).click();
    await expect(installmentRow(page, 1)).not.toContainText("Pago");
    await expect(installmentRow(page, 1)).toContainText("Pendente", { timeout: 5_000 });
  });

  test("estorna um recebimento e permite receber a parcela de novo", async ({ page }) => {
    test.fail(
      true,
      "Bug conhecido: Payment.installmentId é único e o estorno só faz soft delete, então registerPayment acha o pagamento antigo"
    );
    acceptDialogs(page);
    const { name } = await createClientViaUi(page, `Estorno ${uniqueSuffix()}`);
    await createInstallmentSale(page, name, 200, 2);

    await payInstallment(page, 1);
    await expect(installmentRow(page, 1)).toContainText("Pago");

    await installmentRow(page, 1).getByRole("button", { name: "Estornar" }).click();
    await expect(installmentRow(page, 1)).not.toContainText("Pago");
    await expect(installmentRow(page, 1).getByRole("button", { name: "Receber" })).toBeVisible();

    await payInstallment(page, 1);
    await expect(installmentRow(page, 1)).toContainText("Pago", { timeout: 5_000 });
  });
});
