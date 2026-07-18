export type RecebimentoTipo = "todos" | "vendas" | "emprestimos";

export function parseRecebimentoTipo(tipo?: string): RecebimentoTipo {
  if (tipo === "vendas" || tipo === "emprestimos") return tipo;
  return "todos";
}
