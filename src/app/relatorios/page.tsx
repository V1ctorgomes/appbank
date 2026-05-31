import { Suspense } from "react";
import Link from "next/link";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, StatCard } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/report-filters";
import { getReportData } from "@/actions/reports";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const defaultStart = format(startOfMonth(now), "yyyy-MM-dd");
  const defaultEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const filters = {
    startDate: params.startDate ?? defaultStart,
    endDate: params.endDate ?? defaultEnd,
  };

  const data = await getReportData(filters);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-slate-500">Resumo financeiro e contas a receber</p>
      </div>

      <Suspense fallback={null}>
        <ReportFilters defaultStart={defaultStart} defaultEnd={defaultEnd} />
      </Suspense>

      <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Entradas"
          value={formatCurrency(data.summary.income)}
          variant="income"
        />
        <StatCard
          title="Total de Saídas"
          value={formatCurrency(data.summary.expense)}
          variant="expense"
        />
        <StatCard
          title="Resultado do Período"
          value={formatCurrency(data.summary.balance)}
          variant={data.summary.balance >= 0 ? "income" : "expense"}
        />
        <StatCard
          title="Total a Receber"
          value={formatCurrency(data.totalReceivable)}
        />
      </div>

      <Card title="Contas a Receber" className="mb-8">
        {data.accountsReceivable.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum valor pendente de recebimento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Valor Pendente</th>
                  <th className="pb-3 font-medium">Parcelas</th>
                  <th className="pb-3 font-medium">Próximo Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {data.accountsReceivable.map((item) => (
                  <tr key={item.clientId} className="border-b border-slate-100">
                    <td className="py-3">
                      <Link
                        href={`/clientes/${item.clientId}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {item.clientName}
                      </Link>
                    </td>
                    <td className="py-3 font-medium text-amber-700">
                      {formatCurrency(item.pendingValue)}
                    </td>
                    <td className="py-3 text-slate-600">{item.pendingCount}</td>
                    <td className="py-3 text-slate-600">
                      {formatDate(item.nextDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Histórico Financeiro">
        {data.transactions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma movimentação no período selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Descrição</th>
                  <th className="pb-3 font-medium">Categoria</th>
                  <th className="pb-3 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="py-3 text-slate-600">{formatDate(tx.date)}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.type === "INCOME"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tx.type === "INCOME" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-slate-800">{tx.description}</td>
                    <td className="py-3 text-slate-600">{tx.category?.name ?? "—"}</td>
                    <td
                      className={`py-3 font-medium ${
                        tx.type === "INCOME" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {tx.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(Number(tx.value))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
