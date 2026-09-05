"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { updateLoan } from "@/actions/loans";
import {
  calcLoanTotalDue,
  calcMonthlyInterest,
  formatBillingMonth,
  generateLoanInstallments,
  isInstallmentFrequency,
  LOAN_INSTALLMENT_COUNTS,
  monthInputFromDate,
  monthInputToDate,
  WEEKDAY_OPTIONS,
  type LoanPaymentFrequency,
} from "@/lib/loan-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface EditLoanFormProps {
  clients: { id: string; name: string }[];
  loan: {
    id: string;
    clientId: string;
    principal: unknown;
    interestRate: unknown;
    paymentFrequency: string;
    paymentDay: number;
    paymentDay2: number | null;
    weekday: number | null;
    billingStartMonth: Date;
    billingStartDate: Date | null;
    loanDate: Date;
    notes: string | null;
  };
}

function toDateInput(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function EditLoanForm({ clients, loan }: EditLoanFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState(loan.clientId);
  const [loanDate, setLoanDate] = useState(toDateInput(loan.loanDate));
  const [principal, setPrincipal] = useState(Number(loan.principal).toFixed(2));
  const [interestRate, setInterestRate] = useState(String(Number(loan.interestRate)));
  const [paymentFrequency, setPaymentFrequency] = useState<LoanPaymentFrequency>(
    (loan.paymentFrequency as LoanPaymentFrequency) || "MONTHLY"
  );
  const [paymentDay, setPaymentDay] = useState(String(loan.paymentDay));
  const [paymentDay2, setPaymentDay2] = useState(String(loan.paymentDay2 ?? 16));
  const [weekday, setWeekday] = useState(String(loan.weekday ?? 1));
  const [billingStartMonth, setBillingStartMonth] = useState(
    monthInputFromDate(loan.billingStartMonth)
  );
  const [billingStartDate, setBillingStartDate] = useState(
    loan.billingStartDate
      ? toDateInput(loan.billingStartDate)
      : toDateInput(loan.loanDate)
  );
  const [notes, setNotes] = useState(loan.notes ?? "");

  const principalNum = parseFloat(principal) || 0;
  const rateNum = parseFloat(interestRate) || 0;
  const paymentDayNum = parseInt(paymentDay, 10) || 1;
  const paymentDay2Num = parseInt(paymentDay2, 10) || 16;
  const weekdayNum = parseInt(weekday, 10);

  const monthlyInterest = useMemo(
    () => calcMonthlyInterest(principalNum, rateNum),
    [principalNum, rateNum]
  );
  const totalDue = useMemo(
    () => calcLoanTotalDue(principalNum, rateNum),
    [principalNum, rateNum]
  );

  const previewInstallments = useMemo(() => {
    if (!isInstallmentFrequency(paymentFrequency) || principalNum <= 0) return [];
    try {
      return generateLoanInstallments({
        frequency: paymentFrequency,
        totalDue,
        billingStartDate,
        weekday: weekdayNum,
        paymentDay: paymentDayNum,
        paymentDay2: paymentDay2Num,
      });
    } catch {
      return [];
    }
  }, [
    paymentFrequency,
    principalNum,
    totalDue,
    billingStartDate,
    weekdayNum,
    paymentDayNum,
    paymentDay2Num,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await updateLoan(loan.id, {
      clientId,
      principal: principalNum,
      interestRate: rateNum,
      paymentFrequency,
      paymentDay:
        paymentFrequency === "MONTHLY" || paymentFrequency === "BIWEEKLY"
          ? paymentDayNum
          : undefined,
      paymentDay2: paymentFrequency === "BIWEEKLY" ? paymentDay2Num : undefined,
      weekday: paymentFrequency === "WEEKLY" ? weekdayNum : undefined,
      billingStartMonth:
        paymentFrequency === "MONTHLY" ? billingStartMonth : undefined,
      billingStartDate:
        paymentFrequency !== "MONTHLY" ? billingStartDate : undefined,
      loanDate,
      notes: notes || undefined,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/emprestimos/${loan.id}`);
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={`/emprestimos/${loan.id}`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Editar Empréstimo</h1>
        <p className="text-slate-500">
          Só é possível editar enquanto nenhum pagamento tiver sido registrado.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
        <Card title="Dados do empréstimo">
          <div className="space-y-4">
            <Select
              label="Cliente *"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Input
              label="Data do empréstimo *"
              type="date"
              value={loanDate}
              onChange={(e) => setLoanDate(e.target.value)}
              required
            />
            <Input
              label="Valor emprestado (R$) *"
              type="number"
              step="0.01"
              min="0.01"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              required
            />
            <Input
              label="Juros mensal (%) *"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              required
            />
            <Select
              label="Forma de cobrança *"
              value={paymentFrequency}
              onChange={(e) =>
                setPaymentFrequency(e.target.value as LoanPaymentFrequency)
              }
              options={[
                { value: "MONTHLY", label: "Mensal" },
                { value: "BIWEEKLY", label: "Quinzenal" },
                { value: "WEEKLY", label: "Semanal" },
                { value: "DAILY", label: "Diária" },
              ]}
              required
            />

            {paymentFrequency === "MONTHLY" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Mês que inicia a cobrança *"
                  type="month"
                  value={billingStartMonth}
                  onChange={(e) => setBillingStartMonth(e.target.value)}
                  required
                />
                <Input
                  label="Dia do pagamento *"
                  type="number"
                  min="1"
                  max="31"
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(e.target.value)}
                  required
                />
              </div>
            )}

            {paymentFrequency === "WEEKLY" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Dia da semana *"
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                  options={WEEKDAY_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  required
                />
                <Input
                  label="Data que inicia a cobrança *"
                  type="date"
                  value={billingStartDate}
                  onChange={(e) => setBillingStartDate(e.target.value)}
                  required
                />
              </div>
            )}

            {paymentFrequency === "DAILY" && (
              <Input
                label="Data que inicia a cobrança *"
                type="date"
                value={billingStartDate}
                onChange={(e) => setBillingStartDate(e.target.value)}
                required
              />
            )}

            {paymentFrequency === "BIWEEKLY" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="1º dia do mês *"
                    type="number"
                    min="1"
                    max="31"
                    value={paymentDay}
                    onChange={(e) => setPaymentDay(e.target.value)}
                    required
                  />
                  <Input
                    label="2º dia do mês *"
                    type="number"
                    min="1"
                    max="31"
                    value={paymentDay2}
                    onChange={(e) => setPaymentDay2(e.target.value)}
                    required
                  />
                </div>
                <Input
                  label="Data que inicia a cobrança *"
                  type="date"
                  value={billingStartDate}
                  onChange={(e) => setBillingStartDate(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="edit-loan-notes" className="block text-sm font-medium text-slate-700">
                Observação
              </label>
              <textarea
                id="edit-loan-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </Card>

        {principalNum > 0 && (
          <Card title="Resumo">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Valor emprestado</span>
                <span className="font-medium">{formatCurrency(principalNum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Juros ({rateNum}%)</span>
                <span className="font-medium">{formatCurrency(monthlyInterest)}</span>
              </div>
              {isInstallmentFrequency(paymentFrequency) ? (
                <>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <span className="text-slate-500">Total a receber</span>
                    <span className="font-semibold">{formatCurrency(totalDue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parcelas</span>
                    <span className="font-medium">
                      {LOAN_INSTALLMENT_COUNTS[paymentFrequency]}×
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Início da cobrança</span>
                    <span className="font-medium">
                      {formatBillingMonth(monthInputToDate(billingStartMonth))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dia do pagamento</span>
                    <span className="font-medium">Todo dia {paymentDayNum}</span>
                  </div>
                </>
              )}
            </div>
            {previewInstallments.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Vencimento</th>
                      <th className="pb-2 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewInstallments.map((inst) => (
                      <tr key={inst.number} className="border-t border-slate-100">
                        <td className="py-1.5">{inst.number}</td>
                        <td className="py-1.5">{formatDate(inst.dueDate)}</td>
                        <td className="py-1.5 font-medium">
                          {formatCurrency(inst.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Link href={`/emprestimos/${loan.id}`}>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </AppLayout>
  );
}
