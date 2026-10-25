import { expect, test } from "@playwright/test";
import {
  acceptDialogs,
  createClientViaUi,
  findClientId,
  formatCpf,
  generateCpf,
  uniqueSuffix,
} from "./helpers";

test.describe("Clientes", () => {
  test("cadastra cliente e abre o detalhe", async ({ page }) => {
    const { name } = await createClientViaUi(page, `Cliente ${uniqueSuffix()}`);
    const id = await findClientId(page, name);
    expect(id).toBeTruthy();
    await page.goto(`/clientes/${id}`);
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("rejeita CPF inválido", async ({ page }) => {
    await page.goto("/clientes/novo");
    await page.getByLabel("Nome *").fill(`Inválido ${uniqueSuffix()}`);
    await page.getByLabel("Telefone *").fill("(11) 98765-4321");
    await page.getByLabel("CPF *").fill("111.111.111-11");
    await page.getByRole("button", { name: "Salvar Cliente" }).click();
    await expect(page.getByText("CPF inválido")).toBeVisible();
    await expect(page).toHaveURL(/\/clientes\/novo/);
  });

  test("rejeita CPF duplicado", async ({ page }) => {
    const cpf = generateCpf();
    await createClientViaUi(page, `Original ${uniqueSuffix()}`, cpf);

    await page.goto("/clientes/novo");
    await page.getByLabel("Nome *").fill(`Duplicado ${uniqueSuffix()}`);
    await page.getByLabel("Telefone *").fill("(11) 98765-4321");
    await page.getByLabel("CPF *").fill(formatCpf(cpf));
    await page.getByRole("button", { name: "Salvar Cliente" }).click();
    await expect(page.getByText("CPF já cadastrado")).toBeVisible();
  });

  test("permite recadastrar o CPF de um cliente excluído", async ({ page }) => {
    test.fail(
      true,
      "Bug conhecido: @@unique([userId, cpf]) inclui clientes excluídos e createClient não trata o erro; o botão fica em 'Salvando...'"
    );
    acceptDialogs(page);
    const cpf = generateCpf();
    const { name } = await createClientViaUi(page, `Excluir ${uniqueSuffix()}`, cpf);

    const id = await findClientId(page, name);
    await page.goto(`/clientes/${id}/editar`);
    await page.getByRole("button", { name: /excluir/i }).click();
    await expect(page).toHaveURL(/\/clientes$/);
    expect(await findClientId(page, name)).toBeNull();

    await page.goto("/clientes/novo");
    await page.getByLabel("Nome *").fill(`Recadastro ${uniqueSuffix()}`);
    await page.getByLabel("Telefone *").fill("(11) 98765-4321");
    await page.getByLabel("CPF *").fill(formatCpf(cpf));
    await page.getByRole("button", { name: "Salvar Cliente" }).click();
    await expect(page).toHaveURL(/\/clientes$/, { timeout: 5_000 });
  });
});
