"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerRentalInstallmentPayment } from "@/actions/rentals";
import { formatCurrency, formatDate } from "@/lib/utils";
import { X } from "lucide-react";

type InstallmentInfo = {
  id: string;
  number: number;
  value: number;
  dueDate: Date | string;
  clientName: string;
  vehicleDescription: string;
};

export function RentalInstallmentPaymentButton({
  installment,
}: {
  installment: InstallmentInfo;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Receber
      </Button>
      {open && (
        <RentalPaymentModal
          installment={installment}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RentalPaymentModal({
  installment,
  onClose,
}: {
  installment: InstallmentInfo;
  onClose: () => void;
}) {
  const router = useRouter();
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await registerRentalInstallmentPayment({
      rentalInstallmentId: installment.id,
      paymentDate,
      notes: notes || undefined,
    });
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Receber parcela #{installment.number}
            </h2>
            <p className="text-sm text-slate-500">
              {installment.clientName} · {installment.vehicleDescription}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Valor</dt>
            <dd className="font-semibold text-slate-900">
              {formatCurrency(installment.value)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Vencimento</dt>
            <dd className="font-semibold text-slate-900">
              {formatDate(installment.dueDate)}
            </dd>
          </div>
        </dl>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Data do pagamento *"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Observação
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : "Confirmar recebimento"}
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
