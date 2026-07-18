"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { createLoan } from "@/actions/loans";
import { calcMonthlyInterest } from "@/lib/loan-utils";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface LoanFormProps {
  clients: { id: string; name: string }[];
}

export function LoanForm({ clients }: LoanFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState("");
  const [loanDate, setLoanDate] = useState(new Date().toISOString().slice(0, 10));
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("10");
  const [paymentDay, setPaymentDay] = useState(
    String(new Date().getDate())
  );
  const [notes, setNotes] = useState("");

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

    const result = await createLoan({
      clientId,
      principal: principalNum,
      interestRate: rateNum,
      paymentDay: paymentDayNum,
      loanDate,
      notes: notes || undefined,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/emprestimos/${result.id}`);
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href="/emprestimos"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Novo Empréstimo</h1>
        <p className="text-slate-500">
          Defina o valor emprestado e o juros mensal. O cliente deve estar cadastrado.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
        <Card title="Dados do empréstimo">
          <div className="space-y-4">
            <Select
              label="Cliente *"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Selecione o cliente"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Input
              label="Data do empréstimo *"
              type="date"
              value={loanDate}
              onChange={(e) => {
                const next = e.target.value;
                setLoanDate(next);
                if (next) {
                  const day = Number(next.slice(8, 10));
                  if (day >= 1 && day <= 31) setPaymentDay(String(day));
                }
              }}
              required
            />
            <Input
              label="Valor emprestado (R$) *"
              type="number"
              step="0.01"
              min="0.01"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="0,00"
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
            <Input
              label="Dia do pagamento *"
              type="number"
              min="1"
              max="31"
              value={paymentDay}
              onChange={(e) => setPaymentDay(e.target.value)}
              required
            />
            <p className="-mt-2 text-xs text-slate-500">
              Dia do mês em que o cliente deve pagar os juros (ex.: 10 = todo dia 10).
            </p>
            <div className="space-y-1">
              <label htmlFor="loan-notes" className="block text-sm font-medium text-slate-700">
                Observação
              </label>
              <textarea
                id="loan-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Informações adicionais..."
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
                <span className="text-slate-500">Juros do 1º mês</span>
                <span className="font-medium">{formatCurrency(monthlyInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dia do pagamento</span>
                <span className="font-medium">Todo dia {paymentDayNum}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">Para quitar no 1º mês</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(principalNum + monthlyInterest)}
                </span>
              </div>
              <p className="pt-2 text-xs text-slate-400">
                Ao receber, você informa quanto o cliente pagou. Se pagar só o juros, a
                dívida permanece. Se pagar juros + parte, o saldo baixa e o próximo juros
                é recalculado. Se pagar tudo, quita.
              </p>
            </div>
          </Card>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading || clients.length === 0}>
            {loading ? "Salvando..." : "Registrar empréstimo"}
          </Button>
          <Link href="/emprestimos">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>

        {clients.length === 0 && (
          <p className="text-sm text-amber-600">
            Cadastre um cliente antes de registrar um empréstimo.{" "}
            <Link href="/clientes" className="underline">
              Ir para clientes
            </Link>
          </p>
        )}
      </form>
    </AppLayout>
  );
}
