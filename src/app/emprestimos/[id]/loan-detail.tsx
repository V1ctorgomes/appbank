"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoanPaymentButton } from "@/components/loans/loan-payment-modal";
import { cancelLoanPayment, deleteLoan } from "@/actions/loans";
import {
  calcMonthlyInterest,
  loanPaymentTypeLabel,
} from "@/lib/loan-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Trash2 } from "lucide-react";

interface LoanDetailProps {
  loan: {
    id: string;
    principal: unknown;
    remainingBalance: unknown;
    interestRate: unknown;
    loanDate: Date;
    notes: string | null;
    status: string;
    settledAt: Date | null;
    client: { id: string; name: string };
    payments: {
      id: string;
      paymentDate: Date;
      type: string;
      totalValue: unknown;
      interestValue: unknown;
      principalValue: unknown;
      balanceBefore: unknown;
      balanceAfter: unknown;
      notes: string | null;
    }[];
  };
}

export function LoanDetail({ loan }: LoanDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const balance = Number(loan.remainingBalance);
  const rate = Number(loan.interestRate);
  const interestDue = calcMonthlyInterest(balance, rate);
  const isActive = loan.status === "ACTIVE";
  const latestPaymentId = loan.payments[0]?.id;

  async function handleCancelPayment(paymentId: string) {
    const confirmed = confirm(
      "Deseja estornar este pagamento? O saldo e o status do empréstimo serão recalculados."
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    const result = await cancelLoanPayment(paymentId);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Deseja realmente excluir este empréstimo?")) return;

    setLoading(true);
    setError("");
    const result = await deleteLoan(loan.id);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/emprestimos");
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/emprestimos"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
        <div className="flex gap-2">
          {isActive && (
            <LoanPaymentButton
              loan={{
                id: loan.id,
                clientName: loan.client.name,
                remainingBalance: balance,
                interestRate: rate,
              }}
              size="sm"
            />
          )}
          {loan.payments.length === 0 && (
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>
              <Trash2 className="mr-1 h-4 w-4" />
              Excluir
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Empréstimo — {formatDate(loan.loanDate)}
              </h1>
              <Link
                href={`/clientes/${loan.client.id}`}
                className="mt-1 text-sm text-primary-600 hover:underline"
              >
                {loan.client.name}
              </Link>
            </div>
            <StatusBadge status={loan.status} />
          </div>

          {loan.notes && (
            <p className="mt-4 text-slate-700">{loan.notes}</p>
          )}

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Principal</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(Number(loan.principal))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Saldo restante</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(balance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Juros mensal</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">{rate}%</dd>
            </div>
            {isActive && (
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">
                  Juros deste mês
                </dt>
                <dd className="mt-1 text-lg font-semibold text-amber-700">
                  {formatCurrency(interestDue)}
                </dd>
              </div>
            )}
            {loan.settledAt && (
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">Quitado em</dt>
                <dd className="mt-1 text-lg font-semibold text-green-700">
                  {formatDate(loan.settledAt)}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title="Como receber">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <strong className="text-slate-800">Só juros:</strong> paga{" "}
              {formatCurrency(interestDue)} — dívida permanece.
            </li>
            <li>
              <strong className="text-slate-800">Juros + parcial:</strong> paga mais que o
              juros — o excedente abate a dívida e o próximo juros é recalculado.
            </li>
            <li>
              <strong className="text-slate-800">Quitação:</strong> paga juros + saldo (
              {formatCurrency(balance + interestDue)}).
            </li>
          </ul>
          {isActive && (
            <div className="mt-4">
              <LoanPaymentButton
                loan={{
                  id: loan.id,
                  clientName: loan.client.name,
                  remainingBalance: balance,
                  interestRate: rate,
                }}
                size="md"
              />
            </div>
          )}
        </Card>
      </div>

      <Card title="Histórico de pagamentos">
        {loan.payments.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum pagamento registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Juros</th>
                  <th className="pb-3 font-medium">Amortização</th>
                  <th className="pb-3 font-medium">Saldo após</th>
                  <th className="pb-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loan.payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100">
                    <td className="py-3 text-slate-600">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="py-3 text-slate-800">
                      {loanPaymentTypeLabel(payment.type)}
                    </td>
                    <td className="py-3 font-medium text-slate-800">
                      {formatCurrency(Number(payment.totalValue))}
                    </td>
                    <td className="py-3 text-slate-600">
                      {formatCurrency(Number(payment.interestValue))}
                    </td>
                    <td className="py-3 text-slate-600">
                      {formatCurrency(Number(payment.principalValue))}
                    </td>
                    <td className="py-3 text-slate-600">
                      {formatCurrency(Number(payment.balanceAfter))}
                    </td>
                    <td className="py-3">
                      {payment.id === latestPaymentId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          onClick={() => handleCancelPayment(payment.id)}
                        >
                          Estornar
                        </Button>
                      )}
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
