"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { WeekdayMultiSelect } from "@/components/loans/weekday-multi-select";
import { createRental } from "@/actions/rentals";
import {
  DEFAULT_DAILY_WEEKDAYS,
  DEFAULT_RENTAL_INSTALLMENT_COUNTS,
  generateRentalInstallments,
  MAX_RENTAL_INSTALLMENTS,
  rentalCountLabel,
  WEEKDAY_OPTIONS,
  type RentalPaymentFrequency,
} from "@/lib/rental-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { roundMoney } from "@/lib/sale-utils";
import { ArrowLeft } from "lucide-react";

export function RentalForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [plate, setPlate] = useState("");
  const [paymentFrequency, setPaymentFrequency] =
    useState<RentalPaymentFrequency>("WEEKLY");
  const [installmentCount, setInstallmentCount] = useState(
    String(DEFAULT_RENTAL_INSTALLMENT_COUNTS.WEEKLY)
  );
  const [installmentValue, setInstallmentValue] = useState("350");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [weekday, setWeekday] = useState("1");
  const [paymentDay, setPaymentDay] = useState(String(new Date().getDate()));
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>([
    ...DEFAULT_DAILY_WEEKDAYS,
  ]);
  const [notes, setNotes] = useState("");

  const countNum = parseInt(installmentCount, 10) || 0;
  const valueNum = parseFloat(installmentValue) || 0;
  const weekdayNum = parseInt(weekday, 10);
  const paymentDayNum = parseInt(paymentDay, 10) || 1;
  const total = roundMoney(valueNum * Math.max(countNum, 0));

  const preview = useMemo(() => {
    if (
      countNum < 1 ||
      countNum > MAX_RENTAL_INSTALLMENTS ||
      valueNum <= 0 ||
      !startDate
    ) {
      return [];
    }
    try {
      return generateRentalInstallments({
        frequency: paymentFrequency,
        installmentValue: valueNum,
        installmentCount: countNum,
        startDate,
        weekday: weekdayNum,
        paymentDay: paymentDayNum,
        activeWeekdays:
          paymentFrequency === "DAILY" ? activeWeekdays : undefined,
      });
    } catch {
      return [];
    }
  }, [
    paymentFrequency,
    valueNum,
    countNum,
    startDate,
    weekdayNum,
    paymentDayNum,
    activeWeekdays,
  ]);

  function handleFrequencyChange(next: RentalPaymentFrequency) {
    setPaymentFrequency(next);
    setInstallmentCount(String(DEFAULT_RENTAL_INSTALLMENT_COUNTS[next]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await createRental({
      clientId,
      vehicleDescription,
      plate: plate || undefined,
      paymentFrequency,
      installmentCount: countNum,
      installmentValue: valueNum,
      startDate,
      paymentDay: paymentFrequency === "MONTHLY" ? paymentDayNum : undefined,
      weekday:
        paymentFrequency === "WEEKLY" || paymentFrequency === "BIWEEKLY"
          ? weekdayNum
          : undefined,
      activeWeekdays:
        paymentFrequency === "DAILY" ? activeWeekdays : undefined,
      notes: notes || undefined,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/alugueis/${result.id}`);
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href="/alugueis"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Novo aluguel</h1>
        <p className="text-slate-500">
          Aluguel com intenção de compra: se pagar tudo certinho, a moto fica com
          o cliente; se não, volta para você e o valor pago permanece.
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
            <Select
              label="Forma de pagamento *"
              value={paymentFrequency}
              onChange={(e) =>
                handleFrequencyChange(e.target.value as RentalPaymentFrequency)
              }
              options={[
                { value: "DAILY", label: "Diária" },
                { value: "WEEKLY", label: "Semanal" },
                { value: "BIWEEKLY", label: "Quinzenal" },
                { value: "MONTHLY", label: "Mensal" },
              ]}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={`${rentalCountLabel(paymentFrequency)} *`}
                type="number"
                min="1"
                max={String(MAX_RENTAL_INSTALLMENTS)}
                value={installmentCount}
                onChange={(e) => setInstallmentCount(e.target.value)}
                required
              />
              <Input
                label="Valor de cada parcela (R$) *"
                type="number"
                step="0.01"
                min="0.01"
                value={installmentValue}
                onChange={(e) => setInstallmentValue(e.target.value)}
                required
              />
            </div>

            <Input
              label="Data de início *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />

            {(paymentFrequency === "WEEKLY" ||
              paymentFrequency === "BIWEEKLY") && (
              <Select
                label={
                  paymentFrequency === "BIWEEKLY"
                    ? "Dia da semana (a cada 14 dias) *"
                    : "Dia da semana do pagamento *"
                }
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                options={WEEKDAY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                required
              />
            )}

            {paymentFrequency === "DAILY" && (
              <WeekdayMultiSelect
                value={activeWeekdays}
                onChange={setActiveWeekdays}
              />
            )}

            {paymentFrequency === "MONTHLY" && (
              <Input
                label="Dia do mês *"
                type="number"
                min="1"
                max="31"
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value)}
                required
              />
            )}

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

        {valueNum > 0 && countNum > 0 && (
          <Card title="Resumo">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Parcelas</span>
                <span className="font-medium">
                  {countNum} × {formatCurrency(valueNum)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">Total do contrato</span>
                <span className="font-semibold">{formatCurrency(total)}</span>
              </div>
            </div>
            {preview.length > 0 && (
              <div className="mt-4 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Vencimento</th>
                      <th className="pb-2 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((inst) => (
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Registrar aluguel"}
          </Button>
          <Link href="/alugueis">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </AppLayout>
  );
}
