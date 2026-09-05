"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoanPaymentButton } from "@/components/loans/loan-payment-modal";
import { LoanInstallmentPaymentButton } from "@/components/loans/loan-installment-payment-modal";
import { cancelLoanPayment, deleteLoan } from "@/actions/loans";
import {
  calcMonthlyInterest,
  formatPaymentSchedule,
  isInstallmentFrequency,
  loanFrequencyLabel,
  loanPaymentTypeLabel,
  settleTotalForLoan,
} from "@/lib/loan-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

interface LoanDetailProps {
  loan: {
    id: string;
    principal: unknown;
    remainingBalance: unknown;
    interestRate: unknown;
    paymentFrequency: string;
    paymentDay: number;
    paymentDay2: number | null;
    weekday: number | null;
    billingStartMonth: Date;
    billingStartDate: Date | null;
    totalDue: unknown;
    installmentCount: number | null;
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
    installments: {
      id: string;
      number: number;
      value: unknown;
      dueDate: Date;
      status: string;
      paidAt: Date | null;
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
  const isInstallment = isInstallmentFrequency(loan.paymentFrequency);
  const settleTotal = settleTotalForLoan({
    paymentFrequency: loan.paymentFrequency,
    remainingBalance: balance,
    interestRate: rate,
  });
  const isActive = loan.status === "ACTIVE";
  const canEdit = isActive && loan.payments.length === 0;
  const latestPaymentId = loan.payments[0]?.id;

  const loanPaymentInfo = {
    id: loan.id,
    clientName: loan.client.name,
    remainingBalance: balance,
    interestRate: rate,
    paymentFrequency: loan.paymentFrequency,
    paymentDay: loan.paymentDay,
    paymentDay2: loan.paymentDay2,
    weekday: loan.weekday,
    billingStartMonth: loan.billingStartMonth,
    billingStartDate: loan.billingStartDate,
  };

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
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link href={`/emprestimos/${loan.id}/editar`}>
              <Button variant="secondary" size="sm">
                <Pencil className="mr-1 h-4 w-4" />
                Editar
              </Button>
            </Link>
          )}
          {isActive && (
            <LoanPaymentButton
              loan={loanPaymentInfo}
              size="sm"
              mode={isInstallment ? "settle" : "normal"}
              label={isInstallment ? "Quitar" : undefined}
            />
          )}
          {canEdit && (
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

          {loan.notes && <p className="mt-4 text-slate-700">{loan.notes}</p>}

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Principal</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(Number(loan.principal))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">
                {isInstallment ? "Saldo em aberto" : "Saldo restante"}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(balance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Juros mensal</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">{rate}%</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Frequência</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {loanFrequencyLabel(loan.paymentFrequency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Cobrança</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {formatPaymentSchedule(loan.paymentDay, loan.billingStartMonth, {
                  paymentFrequency: loan.paymentFrequency,
                  weekday: loan.weekday,
                  paymentDay2: loan.paymentDay2,
                  billingStartDate: loan.billingStartDate,
                })}
              </dd>
            </div>
            {isInstallment && loan.totalDue != null && (
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">
                  Total do ciclo
                </dt>
                <dd className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCurrency(Number(loan.totalDue))}
                </dd>
              </div>
            )}
            {isActive && !isInstallment && (
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
          {isInstallment ? (
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <strong className="text-slate-800">Parcela:</strong> receba cada
                parcela na data de vencimento.
              </li>
              <li>
                <strong className="text-slate-800">Quitação:</strong> paga o saldo em
                aberto ({formatCurrency(settleTotal)}) e encerra o empréstimo.
              </li>
            </ul>
          ) : (
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <strong className="text-slate-800">Só juros:</strong> paga{" "}
                {formatCurrency(interestDue)} — dívida permanece.
              </li>
              <li>
                <strong className="text-slate-800">Juros + parcial:</strong> paga mais
                que o juros — o excedente abate a dívida.
              </li>
              <li>
                <strong className="text-slate-800">Quitação:</strong> paga juros + saldo
                ({formatCurrency(settleTotal)}).
              </li>
            </ul>
          )}
          {isActive && (
            <div className="mt-4">
              <LoanPaymentButton
                loan={loanPaymentInfo}
                size="md"
                mode={isInstallment ? "settle" : "normal"}
                label={isInstallment ? "Quitar tudo" : undefined}
              />
            </div>
          )}
        </Card>
      </div>

      {isInstallment && (
        <Card title="Parcelas" className="mb-8">
          {loan.installments.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma parcela gerada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Vencimento</th>
                    <th className="pb-3 font-medium">Valor</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.installments.map((inst) => (
                    <tr key={inst.id} className="border-t border-slate-100">
                      <td className="py-3 text-slate-600">{inst.number}</td>
                      <td className="py-3 text-slate-600">{formatDate(inst.dueDate)}</td>
                      <td className="py-3 font-medium text-slate-800">
                        {formatCurrency(Number(inst.value))}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="py-3">
                        {isActive &&
                          (inst.status === "PENDING" || inst.status === "OVERDUE") && (
                            <LoanInstallmentPaymentButton
                              installment={{
                                id: inst.id,
                                number: inst.number,
                                value: Number(inst.value),
                                dueDate: inst.dueDate.toISOString(),
                                clientName: loan.client.name,
                                loanId: loan.id,
                              }}
                            />
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

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
