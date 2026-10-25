import { expect, test } from "@playwright/test";

const routes = [
  { path: "/dashboard", heading: /dashboard/i },
  { path: "/clientes", heading: /clientes/i },
  { path: "/vendas", heading: /vendas/i },
  { path: "/emprestimos", heading: /empréstimos/i },
  { path: "/recebimentos", heading: /recebimentos/i },
  { path: "/movimentacoes", heading: /movimentações/i },
  { path: "/metas", heading: /metas/i },
  { path: "/rotina", heading: /rotina/i },
  { path: "/relatorios", heading: /relatórios/i },
  { path: "/configuracoes", heading: /configurações/i },
];

test.describe("Navegação autenticada", () => {
  for (const route of routes) {
    test(`abre ${route.path} sem erros`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      const response = await page.goto(route.path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(new RegExp(route.path));
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
      await expect(page.getByText("Application error")).toHaveCount(0);
      expect(pageErrors).toEqual([]);
    });
  }
});
