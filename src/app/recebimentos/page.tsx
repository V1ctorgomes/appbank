import { Suspense } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentButton } from "@/components/payments/payment-modal";
import { RecebimentosMonthFilter } from "@/components/payments/recebimentos-month-filter";
import { getPendingInstallments, getPaymentHistory } from "@/actions/payments";
import { parseMonthFilter } from "@/lib/month-filter";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ mes?: string }>;
}

export default async function RecebimentosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthKey = params.mes ?? format(new Date(), "yyyy-MM");
  const monthInfo = parseMonthFilter(monthKey);

  const [pendingData, historyData] = await Promise.all([
    getPendingInstallments(monthKey),
    getPaymentHistory(monthKey),
  ]);

  const { items: pending, totalValue: pendingTotal } = pendingData;
  const { items: history, totalValue: historyTotal } = historyData;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Recebimentos</h1>
        <p className="text-slate-500">
          Parcelas e recebimentos do mês selecionado
        </p>
      </div>

      <Suspense fallback={null}>
        <RecebimentosMonthFilter
          defaultMonth={monthInfo.key}
          monthLabel={monthInfo.label}
        />
      </Suspense>

      <Card
        title={`A receber no mês (${pending.length})`}
        className="mb-8"
      >
        <p className="mb-4 text-sm text-slate-600">
          Total pendente:{" "}
          <span className="font-semibold text-amber-700">
            {formatCurrency(pendingTotal)}
          </span>
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma parcela com vencimento neste mês.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Parcela</th>
                  <th className="pb-3 font-medium">Valor</th>
                  <th className="pb-3 font-medium">Vencimento</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((inst) => (
                  <tr key={inst.id} className="border-b border-slate-100">
                    <td className="py-3">
                      <Link
                        href={`/clientes/${inst.sale.client.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {inst.sale.client.name}
                      </Link>
                    </td>
                    <td className="py-3 text-slate-600">
                      <Link
                        href={`/vendas/${inst.saleId}`}
                        className="hover:text-primary-600 hover:underline"
                      >
                        #{inst.number}
                      </Link>
                    </td>
                    <td className="py-3 font-medium text-slate-800">
                      {formatCurrency(Number(inst.value))}
                    </td>
                    <td className="py-3 text-slate-600">{formatDate(inst.dueDate)}</td>
                    <td className="py-3">
                      <StatusBadge status={inst.status} />
                    </td>
                    <td className="py-3">
                      <PaymentButton
                        installment={{
                          id: inst.id,
                          number: inst.number,
                          value: Number(inst.value),
                          dueDate: inst.dueDate.toISOString(),
                          clientName: inst.sale.client.name,
                          saleId: inst.saleId,
                        }}
                      />
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
            Nenhum recebimento registrado neste mês.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Data do pagamento</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Parcela</th>
                  <th className="pb-3 font-medium">Valor</th>
                  <th className="pb-3 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {history.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="py-3 text-slate-600">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="py-3 font-medium text-slate-800">
                      {payment.installment.sale.client.name}
                    </td>
                    <td className="py-3 text-slate-600">
                      #{payment.installment.number}
                    </td>
                    <td className="py-3 font-medium text-green-700">
                      {formatCurrency(Number(payment.value))}
                    </td>
                    <td className="py-3 text-slate-500">
                      {payment.notes || "—"}
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
