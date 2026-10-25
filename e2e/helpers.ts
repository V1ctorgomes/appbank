import { expect, type Page } from "@playwright/test";

export const E2E_USER = {
  name: "Usuário E2E",
  email: "e2e@appbank.test",
  password: "senha-e2e-123",
};

export function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

export function generateCpf(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  if (digits.every((d) => d === digits[0])) digits[0] = (digits[0] + 1) % 10;

  const calc = (base: number[]) => {
    const sum = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  digits.push(calc(digits));
  digits.push(calc(digits));
  return digits.join("");
}

export function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

/** Formata como o app (`Intl` pt-BR, BRL), trocando o espaço não separável por regex flexível. */
export function brl(value: number): RegExp {
  const text = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/\s/g, " ");
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s");
  return new RegExp(escaped);
}

export async function createClientViaUi(page: Page, name: string, cpf = generateCpf()) {
  await page.goto("/clientes/novo");
  await page.getByLabel("Nome *").fill(name);
  await page.getByLabel("Telefone *").fill("(11) 98765-4321");
  await page.getByLabel("CPF *").fill(formatCpf(cpf));
  await page.getByRole("button", { name: "Salvar Cliente" }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  return { name, cpf };
}

/** A lista de clientes é paginada; o select de nova venda traz todos os clientes ativos. */
export async function findClientId(page: Page, name: string): Promise<string | null> {
  await page.goto("/vendas/nova");
  const option = page.getByLabel("Cliente *").locator("option", { hasText: name });
  if ((await option.count()) === 0) return null;
  return option.first().getAttribute("value");
}

export function acceptDialogs(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}
