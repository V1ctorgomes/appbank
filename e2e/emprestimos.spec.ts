import { expect, test, type Page } from "@playwright/test";
import { acceptDialogs, brl, createClientViaUi, todayInput, uniqueSuffix } from "./helpers";

function card(page: Page, title: string) {
  return page
    .locator("div.rounded-xl")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

function detailValue(page: Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

async function fillLoanBasics(page: Page, clientName: string, principal: number, rate: number) {
  await page.goto("/emprestimos/novo");
  await page.getByLabel("Cliente *").selectOption({ label: clientName });
  await page.getByLabel("Data do empréstimo *").fill(todayInput());
  await page.getByLabel("Valor emprestado (R$) *").fill(String(principal));
  await page.getByLabel("Juros mensal (%) *").fill(String(rate));
}

test.describe("Empréstimos", () => {
  test("semanal com quantidade de semanas personalizada", async ({ page }) => {
    const { name } = await createClientViaUi(page, `Semanal ${uniqueSuffix()}`);
    await fillLoanBasics(page, name, 1000, 20);

    await page.getByLabel("Forma de cobrança *").selectOption("WEEKLY");
    const weeks = page.getByLabel("Quantidade de semanas *");
    await expect(weeks).toHaveValue("4");
    await weeks.fill("8");

    const summary = card(page, "Resumo");
    await expect(summary).toContainText(brl(1200));
    await expect(summary).toContainText(/8\s×\sR\$\s150,00/);
    await expect(summary.locator("tbody tr")).toHaveCount(8);

    await page.getByRole("button", { name: "Registrar empréstimo" }).click();
    await expect(page).toHaveURL(/\/emprestimos\/[^/]+$/);

    const installments = card(page, "Parcelas").locator("tbody tr");
    await expect(installments).toHaveCount(8);
    for (let i = 0; i < 8; i++) {
      await expect(installments.nth(i)).toContainText(brl(150));
    }
    await expect(detailValue(page, "Saldo em aberto")).toHaveText(brl(1200));

    await installments.first().getByRole("button", { name: "Receber" }).click();
    await expect(page.getByRole("heading", { name: "Receber parcela" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar recebimento" }).click();

    await expect(installments.first()).toContainText("Pago");
    await expect(detailValue(page, "Saldo em aberto")).toHaveText(brl(1050));
  });

  test("edição mantém a quantidade de parcelas salva", async ({ page }) => {
    const { name } = await createClientViaUi(page, `Edicao ${uniqueSuffix()}`);
    await fillLoanBasics(page, name, 500, 10);
    await page.getByLabel("Forma de cobrança *").selectOption("DAILY");
    await page.getByLabel("Quantidade de dias *").fill("10");
    await page.getByRole("button", { name: "Registrar empréstimo" }).click();
    await expect(page).toHaveURL(/\/emprestimos\/[^/]+$/);
    await expect(card(page, "Parcelas").locator("tbody tr")).toHaveCount(10);

    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByLabel("Quantidade de dias *")).toHaveValue("10");
    await page.getByLabel("Quantidade de dias *").fill("5");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page).toHaveURL(/\/emprestimos\/[^/]+$/);
    const rows = card(page, "Parcelas").locator("tbody tr");
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText(brl(110));
  });

  test("mensal: só juros, amortização parcial e estorno", async ({ page }) => {
    test.fail(
      true,
      "Bug conhecido: com dois pagamentos no mesmo dia, getLoan ordena só por paymentDate e o botão Estornar aparece no pagamento errado"
    );
    acceptDialogs(page);
    const { name } = await createClientViaUi(page, `Mensal ${uniqueSuffix()}`);
    await fillLoanBasics(page, name, 1000, 10);
    await page.getByRole("button", { name: "Registrar empréstimo" }).click();
    await expect(page).toHaveURL(/\/emprestimos\/[^/]+$/);
    await expect(detailValue(page, "Saldo restante")).toHaveText(brl(1000));
    await expect(detailValue(page, "Juros deste mês")).toHaveText(brl(100));

    const history = card(page, "Histórico de pagamentos");

    await page.getByRole("button", { name: "Receber juros do mês" }).first().click();
    await page.getByRole("button", { name: "Só juros" }).click();
    await expect(page.getByLabel("Quanto pagou? *")).toHaveValue("100.00");
    await page.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect(history.locator("tbody tr")).toHaveCount(1);
    await expect(history).toContainText("Só juros");
    await expect(detailValue(page, "Saldo restante")).toHaveText(brl(1000));

    await page.getByRole("button", { name: "Receber juros do mês" }).first().click();
    await page.getByLabel("Quanto pagou? *").fill("600");
    await expect(page.getByText("Juros + amortização").first()).toBeVisible();
    await page.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect(history.locator("tbody tr")).toHaveCount(2);
    await expect(detailValue(page, "Saldo restante")).toHaveText(brl(500));

    await history.getByRole("button", { name: "Estornar" }).click();
    await expect(history.locator("tbody tr")).toHaveCount(1, { timeout: 5_000 });
    await expect(detailValue(page, "Saldo restante")).toHaveText(brl(1000));
  });

  test("quitação de empréstimo mensal encerra o contrato", async ({ page }) => {
    const { name } = await createClientViaUi(page, `Quitar ${uniqueSuffix()}`);
    await fillLoanBasics(page, name, 800, 5);
    await page.getByRole("button", { name: "Registrar empréstimo" }).click();
    await expect(page).toHaveURL(/\/emprestimos\/[^/]+$/);

    await page.getByRole("button", { name: "Receber juros do mês" }).first().click();
    await page.getByRole("button", { name: "Quitar tudo" }).click();
    await expect(page.getByLabel("Quanto pagou? *")).toHaveValue("840.00");
    await page.getByRole("button", { name: "Confirmar recebimento" }).click();

    await expect(page.getByText("Quitado").first()).toBeVisible();
    await expect(detailValue(page, "Saldo restante")).toHaveText(brl(0));
  });
});
