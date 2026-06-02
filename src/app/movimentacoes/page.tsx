import { Suspense } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, StatCard } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { NewTransactionButton, EditTransactionButton } from "@/components/transactions/transaction-modal";
import { TransactionFilters as TransactionFiltersForm } from "@/components/transactions/transaction-filters";
import { getTransactions, getTransactionSummary, type TransactionFilters } from "@/actions/transactions";
import { getCategories } from "@/actions/categories";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    categoryId?: string;
    search?: string;
  }>;
}

export default async function MovimentacoesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const defaultStart = format(startOfMonth(now), "yyyy-MM-dd");
  const defaultEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const filters: TransactionFilters = {
    startDate: params.startDate ?? defaultStart,
    endDate: params.endDate ?? defaultEnd,
    type:
      params.type === "INCOME" || params.type === "EXPENSE"
        ? params.type
        : undefined,
    categoryId: params.categoryId,
    search: params.search,
  };

  const paginationParams = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    type: filters.type,
    categoryId: filters.categoryId,
    search: filters.search,
  };

  const [transactionsResult, summary, categories] = await Promise.all([
    getTransactions(filters, params.page),
    getTransactionSummary(filters),
    getCategories(),
  ]);

  const { items: transactions, page, totalPages } = transactionsResult;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Movimentações</h1>
          <p className="text-slate-500">
            {summary.count} movimentação(ões) no período · página {page} de {totalPages}
          </p>
        </div>
        <NewTransactionButton categories={categories} />
      </div>

      <Suspense fallback={null}>
        <TransactionFiltersForm
          categories={categories}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
        />
      </Suspense>

      <div className="my-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Entradas"
          value={formatCurrency(summary.income)}
          variant="income"
        />
        <StatCard
          title="Saídas"
          value={formatCurrency(summary.expense)}
          variant="expense"
        />
        <StatCard
          title="Resultado"
          value={formatCurrency(summary.balance)}
          variant={summary.balance >= 0 ? "income" : "expense"}
        />
      </div>

      <Card title={`Movimentações (${summary.count})`}>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma movimentação encontrada no período.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-3 font-medium">Data</th>
                    <th className="pb-3 font-medium">Tipo</th>
                    <th className="pb-3 font-medium">Descrição</th>
                    <th className="pb-3 font-medium">Categoria</th>
                    <th className="pb-3 font-medium">Origem</th>
                    <th className="pb-3 font-medium">Valor</th>
                    <th className="pb-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
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
                      <td className="py-3 text-slate-600">
                        {tx.category?.name ?? "—"}
                      </td>
                      <td className="py-3 text-slate-500">
                        {tx.origin === "INSTALLMENT_PAYMENT" ? "Recebimento" : "Manual"}
                      </td>
                      <td
                        className={`py-3 font-medium ${
                          tx.type === "INCOME" ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {tx.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(Number(tx.value))}
                      </td>
                      <td className="py-3">
                        {tx.origin === "MANUAL" && (
                          <EditTransactionButton
                            categories={categories}
                            transaction={{
                              id: tx.id,
                              type: tx.type,
                              description: tx.description,
                              categoryId: tx.categoryId ?? "",
                              value: Number(tx.value).toFixed(2),
                              date: format(new Date(tx.date), "yyyy-MM-dd"),
                              notes: tx.notes ?? "",
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/movimentacoes"
              searchParams={paginationParams}
            />
            <p className="mt-2 text-xs text-slate-400">
              Exibindo até {PAGE_SIZE} movimentações por página
            </p>
          </>
        )}
      </Card>
    </AppLayout>
  );
}
