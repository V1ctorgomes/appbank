import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

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
