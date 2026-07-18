"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerLoanPayment } from "@/actions/loans";
import {
  allocateLoanPayment,
  formatPaymentSchedule,
  loanPaymentTypeLabel,
} from "@/lib/loan-utils";
import { formatCurrency } from "@/lib/utils";
import { X } from "lucide-react";

export interface LoanPaymentInfo {
  id: string;
  clientName: string;
  remainingBalance: number;
  interestRate: number;
  paymentDay?: number;
  billingStartMonth?: Date | string;
}

interface LoanPaymentModalProps {
  loan: LoanPaymentInfo;
  onClose: () => void;
}

export function LoanPaymentModal({ loan, onClose }: LoanPaymentModalProps) {
  const router = useRouter();
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const interestDue = useMemo(
    () =>
      Math.round(((loan.remainingBalance * loan.interestRate) / 100) * 100) / 100,
    [loan.remainingBalance, loan.interestRate]
  );
  const settleTotal = useMemo(
    () => Math.round((loan.remainingBalance + interestDue) * 100) / 100,
    [loan.remainingBalance, interestDue]
  );

  const [value, setValue] = useState(interestDue.toFixed(2));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => {
    const paid = parseFloat(value);
    if (!paid || paid <= 0) return null;
    const result = allocateLoanPayment(
      loan.remainingBalance,
      loan.interestRate,
      paid
    );
    if ("error" in result) return null;
    return result;
  }, [value, loan.remainingBalance, loan.interestRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await registerLoanPayment({
      loanId: loan.id,
      paymentDate,
      value: parseFloat(value),
      notes: notes || undefined,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Receber juros do mês</h2>
            <p className="text-sm text-slate-500">{loan.clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

            <div className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Saldo da dívida</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(loan.remainingBalance)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Juros mensal ({loan.interestRate}%)</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(interestDue)}
            </span>
          </div>
          {loan.paymentDay != null && loan.billingStartMonth != null && (
            <div className="flex justify-between">
              <span className="text-slate-500">Cobrança</span>
              <span className="font-medium text-slate-800 text-right">
                {formatPaymentSchedule(loan.paymentDay, loan.billingStartMonth)}
              </span>
            </div>
          )}
          {loan.paymentDay != null && loan.billingStartMonth == null && (
            <div className="flex justify-between">
              <span className="text-slate-500">Dia do pagamento</span>
              <span className="font-medium text-slate-800">Todo dia {loan.paymentDay}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500">Para quitar</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(settleTotal)}
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setValue(interestDue.toFixed(2))}
          >
            Só juros
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setValue(settleTotal.toFixed(2))}
          >
            Quitar tudo
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Data do Pagamento *"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
          <Input
            label="Quanto pagou? *"
            type="number"
            step="0.01"
            min="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500">
            O sistema identifica automaticamente: só juros, juros + amortização parcial,
            ou quitação.
          </p>

          {preview && (
            <div className="space-y-1.5 rounded-lg border border-primary-200 bg-primary-50/50 p-3 text-sm">
              <p className="font-medium text-primary-800">
                {loanPaymentTypeLabel(preview.type)}
              </p>
              <div className="flex justify-between text-slate-600">
                <span>Juros</span>
                <span>{formatCurrency(preview.interestValue)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amortização</span>
                <span>{formatCurrency(preview.principalValue)}</span>
              </div>
              <div className="flex justify-between border-t border-primary-100 pt-1.5 font-medium text-slate-800">
                <span>Novo saldo</span>
                <span>{formatCurrency(preview.balanceAfter)}</span>
              </div>
              {preview.type === "INTEREST_AND_PARTIAL" && (
                <p className="pt-1 text-xs text-slate-500">
                  Próximo juros será recalculado sobre {formatCurrency(preview.balanceAfter)}.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="loan-payment-notes" className="block text-sm font-medium text-slate-700">
              Observação
            </label>
            <textarea
              id="loan-payment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Informações adicionais..."
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Registrando..." : "Confirmar recebimento"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface LoanPaymentButtonProps {
  loan: LoanPaymentInfo;
  size?: "sm" | "md";
  label?: string;
}

export function LoanPaymentButton({
  loan,
  size = "sm",
  label = "Receber juros do mês",
}: LoanPaymentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <LoanPaymentModal loan={loan} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
