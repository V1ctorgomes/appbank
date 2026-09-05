"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerLoanInstallmentPayment } from "@/actions/loans";
import { formatCurrency, formatDate } from "@/lib/utils";
import { X } from "lucide-react";

export interface LoanInstallmentInfo {
  id: string;
  number: number;
  value: number;
  dueDate: string;
  clientName: string;
  loanId: string;
}

interface LoanInstallmentPaymentModalProps {
  installment: LoanInstallmentInfo;
  onClose: () => void;
}

export function LoanInstallmentPaymentModal({
  installment,
  onClose,
}: LoanInstallmentPaymentModalProps) {
  const router = useRouter();
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [value] = useState(installment.value.toFixed(2));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await registerLoanInstallmentPayment({
      loanInstallmentId: installment.id,
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
            <h2 className="text-lg font-bold text-slate-900">Receber parcela</h2>
            <p className="text-sm text-slate-500">
              {installment.clientName} — Parcela {installment.number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Valor da parcela</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(installment.value)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">Vencimento</span>
            <span className="font-medium text-slate-800">
              {formatDate(installment.dueDate)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Data do Pagamento *"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
          <Input label="Valor *" type="number" step="0.01" value={value} readOnly />

          <div className="space-y-1">
            <label
              htmlFor="loan-inst-notes"
              className="block text-sm font-medium text-slate-700"
            >
              Observação
            </label>
            <textarea
              id="loan-inst-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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

export function LoanInstallmentPaymentButton({
  installment,
  size = "sm",
}: {
  installment: LoanInstallmentInfo;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        Receber
      </Button>
      {open && (
        <LoanInstallmentPaymentModal
          installment={installment}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
