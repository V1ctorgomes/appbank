"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerPayment } from "@/actions/payments";
import { formatCurrency } from "@/lib/utils";
import { X } from "lucide-react";

export interface PaymentInstallmentInfo {
  id: string;
  number: number;
  value: number;
  dueDate: string;
  clientName: string;
  saleId: string;
}

interface PaymentModalProps {
  installment: PaymentInstallmentInfo;
  onClose: () => void;
}

export function PaymentModal({ installment, onClose }: PaymentModalProps) {
  const router = useRouter();
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [value, setValue] = useState(installment.value.toFixed(2));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await registerPayment({
      installmentId: installment.id,
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
            <h2 className="text-lg font-bold text-slate-900">Registrar Recebimento</h2>
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
            label="Valor Recebido *"
            type="number"
            step="0.01"
            min="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label htmlFor="payment-notes" className="block text-sm font-medium text-slate-700">
              Observação
            </label>
            <textarea
              id="payment-notes"
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
              {loading ? "Registrando..." : "Confirmar Recebimento"}
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

interface PaymentButtonProps {
  installment: PaymentInstallmentInfo;
  size?: "sm" | "md";
}

export function PaymentButton({ installment, size = "sm" }: PaymentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        Receber
      </Button>
      {open && (
        <PaymentModal installment={installment} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
