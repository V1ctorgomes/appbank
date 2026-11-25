"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateRental } from "@/actions/rentals";
import { formatCurrency } from "@/lib/utils";

type EditRentalFormProps = {
  clients: { id: string; name: string }[];
  rental: {
    id: string;
    clientId: string;
    vehicleDescription: string;
    plate: string | null;
    notes: string | null;
    totalValue: number;
    vehicleCost: number | null;
  };
};

export function EditRentalForm({ clients, rental }: EditRentalFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState(rental.clientId);
  const [vehicleDescription, setVehicleDescription] = useState(
    rental.vehicleDescription
  );
  const [plate, setPlate] = useState(rental.plate ?? "");
  const [vehicleCost, setVehicleCost] = useState(
    rental.vehicleCost != null ? String(rental.vehicleCost) : ""
  );
  const [notes, setNotes] = useState(rental.notes ?? "");

  const costNum = parseFloat(vehicleCost);
  const hasCost = vehicleCost.trim() !== "" && !Number.isNaN(costNum);
  const profit = hasCost ? rental.totalValue - costNum : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await updateRental(rental.id, {
      clientId,
      vehicleDescription,
      plate: plate || undefined,
      vehicleCost: hasCost ? costNum : undefined,
      notes: notes || undefined,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/alugueis/${rental.id}`);
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={`/alugueis/${rental.id}`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Editar aluguel</h1>
        <p className="text-slate-500">
          Parcelas, valores e datas do contrato não mudam aqui.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
        <Card title="Contrato">
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
              label="Moto / veículo *"
              value={vehicleDescription}
              onChange={(e) => setVehicleDescription(e.target.value)}
              placeholder="Ex.: Honda CG 160 Fan 2022"
              required
            />
            <Input
              label="Placa"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC1D23"
            />
            <div>
              <Input
                label="Custo da moto (R$)"
                type="number"
                step="0.01"
                min="0"
                value={vehicleCost}
                onChange={(e) => setVehicleCost(e.target.value)}
                placeholder="Quanto você pagou na moto"
                autoFocus={rental.vehicleCost == null}
              />
              <p className="mt-1 text-xs text-slate-400">
                Total do contrato: {formatCurrency(rental.totalValue)}
                {profit != null && (
                  <>
                    {" · "}
                    <span
                      className={profit >= 0 ? "text-green-700" : "text-red-700"}
                    >
                      Lucro do contrato: {formatCurrency(profit)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Observação
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Condições do contrato..."
              />
            </div>
          </div>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Link href={`/alugueis/${rental.id}`}>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
