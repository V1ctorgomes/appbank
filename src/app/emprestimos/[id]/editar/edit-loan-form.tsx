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
  calcMonthlyInterest,
  formatBillingMonth,
  monthInputFromDate,
  monthInputToDate,
} from "@/lib/loan-utils";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface EditLoanFormProps {
  clients: { id: string; name: string }[];
  loan: {
    id: string;
    clientId: string;
    principal: unknown;
    interestRate: unknown;
    paymentDay: number;
    billingStartMonth: Date;
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
  const [paymentDay, setPaymentDay] = useState(String(loan.paymentDay));
  const [billingStartMonth, setBillingStartMonth] = useState(
    monthInputFromDate(loan.billingStartMonth)
  );
  const [notes, setNotes] = useState(loan.notes ?? "");

  const principalNum = parseFloat(principal) || 0;
  const rateNum = parseFloat(interestRate) || 0;
  const paymentDayNum = parseInt(paymentDay, 10) || 1;

  const monthlyInterest = useMemo(
    () => calcMonthlyInterest(principalNum, rateNum),
    [principalNum, rateNum]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await updateLoan(loan.id, {
      clientId,
      principal: principalNum,
      interestRate: rateNum,
      paymentDay: paymentDayNum,
      billingStartMonth,
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
                <span className="text-slate-500">Juros do mês</span>
                <span className="font-medium">{formatCurrency(monthlyInterest)}</span>
              </div>
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
            </div>
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
