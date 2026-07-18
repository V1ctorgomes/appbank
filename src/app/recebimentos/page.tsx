import { Suspense } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentButton } from "@/components/payments/payment-modal";
import { LoanPaymentButton } from "@/components/loans/loan-payment-modal";
import { RecebimentosMonthFilter } from "@/components/payments/recebimentos-month-filter";
import {
  getPendingRecebimentos,
  getHistoryRecebimentos,
  parseRecebimentoTipo,
} from "@/actions/recebimentos";
import { parseMonthFilter } from "@/lib/month-filter";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ mes?: string; tipo?: string }>;
}

export default async function RecebimentosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthKey = params.mes ?? format(new Date(), "yyyy-MM");
  const tipo = parseRecebimentoTipo(params.tipo);
  const monthInfo = parseMonthFilter(monthKey);

  const [pendingData, historyData] = await Promise.all([
    getPendingRecebimentos(monthKey, tipo),
    getHistoryRecebimentos(monthKey, tipo),
  ]);

  const { items: pending, totalValue: pendingTotal } = pendingData;
  const { items: history, totalValue: historyTotal } = historyData;

  const subtitle =
    tipo === "vendas"
      ? "Parcelas de vendas do mês"
      : tipo === "emprestimos"
        ? "Juros de empréstimos do mês"
        : "Vendas e empréstimos do mês selecionado";

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Recebimentos</h1>
        <p className="text-slate-500">{subtitle}</p>
      </div>

      <Suspense fallback={null}>
        <RecebimentosMonthFilter
          defaultMonth={monthInfo.key}
          monthLabel={monthInfo.label}
          defaultTipo={tipo}
        />
      </Suspense>

      <Card title={`A receber no mês (${pending.length})`} className="mb-8">
        <p className="mb-4 text-sm text-slate-600">
          Total pendente:{" "}
          <span className="font-semibold text-amber-700">
            {formatCurrency(pendingTotal)}
          </span>
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nada a receber neste mês com o filtro atual.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Referência</th>
                  <th className="pb-3 font-medium">Valor</th>
                  <th className="pb-3 font-medium">Vencimento</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item) => (
                  <tr key={`${item.kind}-${item.id}`} className="border-b border-slate-100">
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.kind === "loan"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.kind === "loan" ? "Empréstimo" : "Venda"}
                      </span>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/clientes/${item.clientId}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {item.clientName}
                      </Link>
                    </td>
                    <td className="py-3 text-slate-600">
                      <Link
                        href={item.href}
                        className="hover:text-primary-600 hover:underline"
                      >
                        {item.label}
                      </Link>
                    </td>
                    <td className="py-3 font-medium text-slate-800">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="py-3 text-slate-600">{formatDate(item.dueDate)}</td>
                    <td className="py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3">
                      {item.kind === "sale" && item.saleId && item.installmentNumber != null ? (
                        <PaymentButton
                          installment={{
                            id: item.id,
                            number: item.installmentNumber,
                            value: item.value,
                            dueDate: item.dueDate,
                            clientName: item.clientName,
                            saleId: item.saleId,
                          }}
                        />
                      ) : item.kind === "loan" && item.loan ? (
                        <LoanPaymentButton
                          loan={{
                            id: item.id,
                            clientName: item.clientName,
                            remainingBalance: item.loan.remainingBalance,
                            interestRate: item.loan.interestRate,
                            paymentDay: item.loan.paymentDay,
                            billingStartMonth: item.loan.billingStartMonth,
                          }}
                          size="sm"
                          label="Receber"
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Recebidos no mês (${history.length})`}>
        <p className="mb-4 text-sm text-slate-600">
          Total recebido:{" "}
          <span className="font-semibold text-green-700">
            {formatCurrency(historyTotal)}
          </span>
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum recebimento registrado neste mês com o filtro atual.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Referência</th>
                  <th className="pb-3 font-medium">Valor</th>
                  <th className="pb-3 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={`${item.kind}-${item.id}`} className="border-b border-slate-100">
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.kind === "loan"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.kind === "loan" ? "Empréstimo" : "Venda"}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">
                      {formatDate(item.paymentDate)}
                    </td>
                    <td className="py-3 font-medium text-slate-800">
                      {item.clientName}
                    </td>
                    <td className="py-3 text-slate-600">
                      <Link
                        href={item.href}
                        className="hover:text-primary-600 hover:underline"
                      >
                        {item.label}
                      </Link>
                    </td>
                    <td className="py-3 font-medium text-green-700">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="py-3 text-slate-500">{item.notes || "—"}</td>
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
