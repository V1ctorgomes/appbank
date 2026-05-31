export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clientes/:path*",
    "/vendas/:path*",
    "/recebimentos/:path*",
    "/movimentacoes/:path*",
    "/relatorios/:path*",
    "/configuracoes/:path*",
  ],
};
