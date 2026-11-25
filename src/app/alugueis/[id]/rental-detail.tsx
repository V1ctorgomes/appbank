"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RentalInstallmentPaymentButton } from "@/components/rentals/rental-payment-modal";
import { RentalCostEditor } from "@/components/rentals/rental-cost-editor";
import { deleteRental, markRentalReturned } from "@/actions/rentals";
import {
  formatRentalSchedule,
  rentalFrequencyLabel,
  rentalStatusLabel,
} from "@/lib/rental-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Bike, Trash2, Undo2 } from "lucide-react";

type RentalDetailProps = {
  rental: {
    id: string;
    vehicleDescription: string;
    plate: string | null;
    paymentFrequency: string;
    installmentCount: number;
    installmentValue: unknown;
    totalValue: unknown;
    vehicleCost: unknown;
    startDate: Date;
    paymentDay: number | null;
    paymentDay2: number | null;
    weekday: number | null;
    activeWeekdays: number[];
    notes: string | null;
    status: string;
    transferredAt: Date | null;
    returnedAt: Date | null;
    client: { id: string; name: string; phone: string };
    installments: {
      id: string;
      number: number;
      value: unknown;
      dueDate: Date;
      status: string;
      paidAt: Date | null;
    }[];
  };
};

export function RentalDetail({ rental }: RentalDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const paid = rental.installments.filter((i) => i.status === "PAID");
  const open = rental.installments.filter(
    (i) => i.status === "PENDING" || i.status === "OVERDUE"
  );
  const paidValue = paid.reduce((s, i) => s + Number(i.value), 0);
  const openValue = open.reduce((s, i) => s + Number(i.value), 0);
  const isActive = rental.status === "ACTIVE";

  async function handleReturn() {
    if (
      !confirm(
        "Confirmar devolução da moto? O contrato será encerrado como devolvido e o valor já pago permanece com você."
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    const result = await markRentalReturned(rental.id);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Excluir este aluguel? Só funciona sem parcelas pagas.")) return;
    setLoading(true);
    setError("");
    const result = await deleteRental(rental.id);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push("/alugueis");
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/alugueis"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {rental.vehicleDescription}
          </h1>
          <p className="text-slate-500">
            <Link
              href={`/clientes/${rental.client.id}`}
              className="text-primary-600 hover:underline"
            >
              {rental.client.name}
            </Link>
            {rental.plate ? ` · ${rental.plate}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={rental.status} />
          {isActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReturn}
              disabled={loading}
            >
              <Undo2 className="mr-1 h-4 w-4" />
              Devolver moto
            </Button>
          )}
          {isActive && paid.length === 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Excluir
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {rental.status === "TRANSFERRED" && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Contrato quitado. A moto ficou com {rental.client.name}
          {rental.transferredAt ? ` em ${formatDate(rental.transferredAt)}` : ""}.
        </p>
      )}
      {rental.status === "RETURNED" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Moto devolvida. Valores já pagos permanecem com você
          {rental.returnedAt ? ` · ${formatDate(rental.returnedAt)}` : ""}.
        </p>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Bike className="h-5 w-5" />
            <h2 className="font-semibold">Dados do contrato</h2>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">
                Frequência
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {rentalFrequencyLabel(rental.paymentFrequency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">
                Agenda
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {formatRentalSchedule({
                  paymentFrequency: rental.paymentFrequency,
                  startDate: rental.startDate,
                  weekday: rental.weekday,
                  paymentDay: rental.paymentDay,
                  paymentDay2: rental.paymentDay2,
                  activeWeekdays: rental.activeWeekdays,
                  installmentCount: rental.installmentCount,
                  installmentValue: Number(rental.installmentValue),
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">
                Parcela
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatCurrency(Number(rental.installmentValue))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">
                Total do contrato
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatCurrency(Number(rental.totalValue))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">
                Já pago
              </dt>
              <dd className="mt-1 font-semibold text-green-700">
                {formatCurrency(paidValue)} ({paid.length}/
                {rental.installmentCount})
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">
                Em aberto
              </dt>
              <dd className="mt-1 font-semibold text-amber-700">
                {formatCurrency(openValue)}
              </dd>
            </div>
          </dl>
          {rental.notes && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {rental.notes}
            </p>
          )}
        </Card>

        <Card title="Resumo">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="font-medium">
                {rentalStatusLabel(rental.status)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Início</span>
              <span className="font-medium">{formatDate(rental.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Telefone</span>
              <span className="font-medium">{rental.client.phone}</span>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <RentalCostEditor
                rentalId={rental.id}
                vehicleCost={
                  rental.vehicleCost != null ? Number(rental.vehicleCost) : null
                }
                totalValue={Number(rental.totalValue)}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card title={`Parcelas (${rental.installments.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Vencimento</th>
                <th className="pb-3 font-medium">Valor</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Pago em</th>
                <th className="pb-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rental.installments.map((inst) => (
                <tr key={inst.id} className="border-b border-slate-100">
                  <td className="py-3">{inst.number}</td>
                  <td className="py-3 text-slate-600">
                    {formatDate(inst.dueDate)}
                  </td>
                  <td className="py-3 font-medium">
                    {formatCurrency(Number(inst.value))}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={inst.status} />
                  </td>
                  <td className="py-3 text-slate-600">
                    {inst.paidAt ? formatDate(inst.paidAt) : "—"}
                  </td>
                  <td className="py-3">
                    {isActive &&
                    (inst.status === "PENDING" || inst.status === "OVERDUE") ? (
                      <RentalInstallmentPaymentButton
                        installment={{
                          id: inst.id,
                          number: inst.number,
                          value: Number(inst.value),
                          dueDate: inst.dueDate,
                          clientName: rental.client.name,
                          vehicleDescription: rental.vehicleDescription,
                        }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppLayout>
  );
}
