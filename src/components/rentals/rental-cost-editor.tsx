"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateRentalCost } from "@/actions/rentals";
import { formatCurrency } from "@/lib/utils";

export function RentalCostEditor({
  rentalId,
  vehicleCost,
  totalValue,
}: {
  rentalId: string;
  vehicleCost: number | null;
  totalValue: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(vehicleCost != null ? String(vehicleCost) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const trimmed = value.trim();
    const parsed = trimmed ? parseFloat(trimmed) : null;
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      setError("Informe um valor válido");
      return;
    }
    setSaving(true);
    setError("");
    const result = await updateRentalCost({ rentalId, vehicleCost: parsed });
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <span className="text-slate-500">Custo da moto</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Deixe vazio para remover"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setError("");
              setValue(vehicleCost != null ? String(vehicleCost) : "");
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">Custo da moto</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline"
        >
          {vehicleCost != null ? formatCurrency(vehicleCost) : "Informar"}
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {vehicleCost != null && (
        <div className="flex justify-between">
          <span className="text-slate-500">Lucro do contrato</span>
          <span
            className={
              totalValue - vehicleCost >= 0
                ? "font-medium text-green-700"
                : "font-medium text-red-700"
            }
          >
            {formatCurrency(totalValue - vehicleCost)}
          </span>
        </div>
      )}
    </div>
  );
}
