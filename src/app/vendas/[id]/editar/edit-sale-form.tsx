"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { updateSale } from "@/actions/sales";
import {
  calcItemTotal,
  calcSaleTotalFromItems,
  formatMoneyBr,
  generateAutoInstallments,
  roundMoney,
} from "@/lib/sale-utils";
import type { SaleItemInput, UpdateSaleInput } from "@/lib/schemas";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type SaleType = "ITEMS" | "DIRECT_VALUE";
type PaymentType = "CASH" | "INSTALLMENT";
type InstallmentMode = "AUTO" | "MANUAL";

type ManualInstallment = {
  id?: string;
  value: string;
  dueDate: string;
};

interface EditSaleFormProps {
  sale: {
    id: string;
    type: SaleType;
    description: string | null;
    saleDate: Date;
    notes: string | null;
    totalValue: unknown;
    clientId: string;
    items: {
      id: string;
      name: string;
      quantity: number;
      unitPrice: unknown;
    }[];
    installments: {
      id: string;
      number: number;
      value: unknown;
      dueDate: Date;
      status: string;
    }[];
  };
  clients: { id: string; name: string }[];
}

function toDateInput(date: Date) {
  return format(new Date(date), "yyyy-MM-dd");
}

function detectPaymentType(
  installments: EditSaleFormProps["sale"]["installments"],
  totalValue: number,
  saleDateStr: string
): PaymentType {
  if (installments.length === 1) {
    const inst = installments[0];
    const instDate = toDateInput(inst.dueDate);
    if (
      instDate === saleDateStr &&
      Math.abs(Number(inst.value) - totalValue) < 0.01
    ) {
      return "CASH";
    }
  }
  return "INSTALLMENT";
}

export function EditSaleForm({ sale, clients }: EditSaleFormProps) {
  const router = useRouter();
  const saleType = sale.type;
  const paidInstallments = sale.installments.filter((i) => i.status === "PAID");
  const unpaidInstallments = sale.installments.filter(
    (i) => i.status === "PENDING" || i.status === "OVERDUE"
  );
  const hasPaid = paidInstallments.length > 0;
  const allPaid = hasPaid && unpaidInstallments.length === 0;

  const paidSum = roundMoney(
    paidInstallments.reduce((s, i) => s + Number(i.value), 0)
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState(sale.clientId);
  const [saleDate, setSaleDate] = useState(toDateInput(sale.saleDate));
  const [notes, setNotes] = useState(sale.notes ?? "");
  const [description, setDescription] = useState(sale.description ?? "");
  const [directValue, setDirectValue] = useState(String(Number(sale.totalValue)));
  const [items, setItems] = useState<SaleItemInput[]>(
    sale.items.length > 0
      ? sale.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        }))
      : [{ name: "", quantity: 1, unitPrice: 0 }]
  );

  const [paymentType, setPaymentType] = useState<PaymentType>(() =>
    detectPaymentType(sale.installments, Number(sale.totalValue), toDateInput(sale.saleDate))
  );
  const [installmentMode, setInstallmentMode] = useState<InstallmentMode>("MANUAL");
  const [installmentCount, setInstallmentCount] = useState(
    String(sale.installments.length || 1)
  );
  const [firstDueDate, setFirstDueDate] = useState(
    sale.installments[0] ? toDateInput(sale.installments[0].dueDate) : ""
  );
  const [manualInstallments, setManualInstallments] = useState<ManualInstallment[]>(() => {
    const source = hasPaid ? unpaidInstallments : sale.installments;
    return source.map((i) => ({
      id: i.id,
      value: Number(i.value).toFixed(2),
      dueDate: toDateInput(i.dueDate),
    }));
  });

  const totalValue = useMemo(() => {
    if (allPaid) return Number(sale.totalValue);
    if (saleType === "DIRECT_VALUE") {
      return roundMoney(parseFloat(directValue) || 0);
    }
    return calcSaleTotalFromItems(
      items.map((i) => ({
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
      }))
    );
  }, [allPaid, sale.totalValue, saleType, directValue, items]);

  const expectedUnpaidSum = roundMoney(totalValue - paidSum);

  const previewInstallments = useMemo(() => {
    if (allPaid || hasPaid) return [];
    if (paymentType === "CASH" || totalValue <= 0) {
      return totalValue > 0
        ? [{ number: 1, value: totalValue, dueDate: saleDate }]
        : [];
    }
    if (installmentMode === "AUTO" && installmentCount && firstDueDate) {
      return generateAutoInstallments(
        totalValue,
        parseInt(installmentCount),
        firstDueDate
      );
    }
    if (installmentMode === "MANUAL") {
      return manualInstallments
        .filter((i) => i.value && i.dueDate)
        .map((inst, index) => ({
          number: index + 1,
          value: roundMoney(parseFloat(inst.value) || 0),
          dueDate: inst.dueDate,
        }));
    }
    return [];
  }, [
    allPaid,
    hasPaid,
    paymentType,
    totalValue,
    saleDate,
    installmentMode,
    installmentCount,
    firstDueDate,
    manualInstallments,
  ]);

  const installmentSum = hasPaid
    ? manualInstallments.reduce((s, i) => s + (parseFloat(i.value) || 0), 0)
    : previewInstallments.reduce((s, i) => s + i.value, 0);

  const installmentMismatch = hasPaid
    ? Math.abs(roundMoney(installmentSum) - expectedUnpaidSum) >= 0.01
    : paymentType === "INSTALLMENT" &&
      previewInstallments.length > 0 &&
      Math.abs(installmentSum - totalValue) >= 0.01;

  const totalBelowPaid = !allPaid && totalValue < paidSum;

  function updateItem(index: number, field: keyof SaleItemInput, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function distributeUnpaidEqually() {
    const count = manualInstallments.length;
    if (count === 0 || expectedUnpaidSum <= 0) return;
    const generated = generateAutoInstallments(
      expectedUnpaidSum,
      count,
      firstDueDate || manualInstallments[0]?.dueDate || saleDate
    );
    setManualInstallments((prev) =>
      prev.map((p, i) => ({
        ...p,
        value: generated[i]?.value.toFixed(2) ?? p.value,
        dueDate: generated[i]?.dueDate ?? p.dueDate,
      }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: UpdateSaleInput = {
        clientId,
        saleDate,
        notes: notes || undefined,
      };

      if (!allPaid) {
        payload.description = saleType === "DIRECT_VALUE" ? description : undefined;
        payload.directValue =
          saleType === "DIRECT_VALUE" ? parseFloat(directValue) : undefined;
        payload.items =
          saleType === "ITEMS"
            ? items.map((i) => ({
                name: i.name,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
              }))
            : undefined;

        if (hasPaid) {
          payload.installments = manualInstallments.map((inst, index) => ({
            id: inst.id,
            number: index + 1,
            value: parseFloat(inst.value),
            dueDate: inst.dueDate,
          }));
        } else {
          payload.paymentType = paymentType;
          payload.installmentMode =
            paymentType === "INSTALLMENT" ? installmentMode : undefined;
          payload.installmentCount =
            paymentType === "INSTALLMENT" && installmentMode === "AUTO"
              ? parseInt(installmentCount)
              : undefined;
          payload.firstDueDate =
            paymentType === "INSTALLMENT" && installmentMode === "AUTO"
              ? firstDueDate
              : undefined;
          payload.installments =
            paymentType === "INSTALLMENT" && installmentMode === "MANUAL"
              ? manualInstallments
                  .filter((i) => i.value && i.dueDate)
                  .map((inst, index) => ({
                    id: inst.id,
                    number: index + 1,
                    value: parseFloat(inst.value),
                    dueDate: inst.dueDate,
                  }))
              : paymentType === "CASH"
                ? [{ number: 1, value: totalValue, dueDate: saleDate }]
                : undefined;
        }
      }

      const result = await updateSale(sale.id, payload);

      if (result?.error) {
        setError(result.error);
        return;
      }

      router.push(`/vendas/${sale.id}`);
      router.refresh();
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={`/vendas/${sale.id}`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <h1 className="mb-2 text-xl font-bold text-slate-900">Editar Venda</h1>
          <p className="mb-6 text-sm text-slate-500">
            Modalidade:{" "}
            <span className="font-medium text-slate-700">
              {saleType === "ITEMS" ? "Por itens" : "Valor direto"}
            </span>
          </p>

          {allPaid && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Todas as parcelas foram pagas. Você pode alterar cliente, data e observação.
            </p>
          )}

          {hasPaid && !allPaid && (
            <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Já recebido: {formatMoneyBr(paidSum)}. O valor em aberto deve somar{" "}
              {formatMoneyBr(expectedUnpaidSum)}.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Cliente *"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Input
              label="Data da Venda *"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
            />
          </div>
        </Card>

        {!allPaid && (
          <Card title={saleType === "ITEMS" ? "Itens da Venda" : "Valor da Venda"}>
            {saleType === "DIRECT_VALUE" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Descrição *"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
                <Input
                  label="Valor Total *"
                  type="number"
                  step="0.01"
                  min={paidSum > 0 ? paidSum : 0.01}
                  value={directValue}
                  onChange={(e) => setDirectValue(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-5">
                      <Input
                        label="Nome"
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        label="Qtd"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", parseInt(e.target.value) || 1)
                        }
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        label="Valor Unit."
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.unitPrice || ""}
                        onChange={(e) =>
                          updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col justify-end">
                      <span className="text-xs text-slate-400">Total</span>
                      <span className="font-medium">
                        {formatCurrency(
                          calcItemTotal(
                            Number(item.quantity) || 0,
                            Number(item.unitPrice) || 0
                          )
                        )}
                      </span>
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setItems((prev) =>
                            prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
                          )
                        }
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setItems((prev) => [...prev, { name: "", quantity: 1, unitPrice: 0 }])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar Item
                </Button>
              </div>
            )}

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
              <div className="text-right">
                <span className="text-sm text-slate-500">Total da Venda</span>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalValue)}
                </p>
                {totalBelowPaid && (
                  <p className="text-xs text-red-600">
                    Mínimo: {formatMoneyBr(paidSum)} (já recebido)
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {hasPaid && !allPaid && (
          <Card title="Parcelas pagas">
            <div className="space-y-2">
              {paidInstallments.map((inst) => (
                <div
                  key={inst.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm"
                >
                  <span>
                    Parcela {inst.number} — {formatCurrency(Number(inst.value))}
                  </span>
                  <StatusBadge status="PAID" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {!allPaid && (
          <Card title={hasPaid ? "Parcelas em aberto" : "Pagamento"}>
            {!hasPaid && (
              <div className="mb-4 flex gap-3">
                {(["CASH", "INSTALLMENT"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      paymentType === type
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {type === "CASH" ? "À Vista" : "Parcelada"}
                  </button>
                ))}
              </div>
            )}

            {(!hasPaid && paymentType === "INSTALLMENT") && (
              <div className="mb-4 flex gap-3">
                {(["AUTO", "MANUAL"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInstallmentMode(mode)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      installmentMode === mode
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {mode === "AUTO" ? "Automático" : "Manual"}
                  </button>
                ))}
              </div>
            )}

            {!hasPaid && paymentType === "INSTALLMENT" && installmentMode === "AUTO" && (
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Quantidade de Parcelas *"
                  type="number"
                  min="1"
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                  required
                />
                <Input
                  label="Primeiro Vencimento *"
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  required
                />
              </div>
            )}

            {(hasPaid || (paymentType === "INSTALLMENT" && installmentMode === "MANUAL")) && (
              <div className="space-y-3">
                {manualInstallments.map((inst, index) => (
                  <div key={inst.id ?? index} className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-1 flex items-end pb-2 text-sm text-slate-400">
                      #{index + 1}
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        label="Valor"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={inst.value}
                        onChange={(e) =>
                          setManualInstallments((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, value: e.target.value } : p
                            )
                          )
                        }
                        required
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        label="Vencimento"
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) =>
                          setManualInstallments((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, dueDate: e.target.value } : p
                            )
                          )
                        }
                        required
                      />
                    </div>
                  </div>
                ))}
                {hasPaid && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={distributeUnpaidEqually}
                  >
                    Redistribuir parcelas em aberto
                  </Button>
                )}
                {!hasPaid && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setManualInstallments((prev) => [
                          ...prev,
                          { value: "", dueDate: "" },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Adicionar Parcela
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!hasPaid && previewInstallments.length > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <p className="mb-2 text-sm font-medium text-slate-700">Prévia das parcelas</p>
                {previewInstallments.map((inst) => (
                  <div
                    key={inst.number}
                    className="flex justify-between text-sm text-slate-600"
                  >
                    <span>Parcela {inst.number}</span>
                    <span>{formatCurrency(inst.value)}</span>
                  </div>
                ))}
              </div>
            )}

            {installmentMismatch && (
              <p className="mt-2 text-sm text-red-600">
                {hasPaid
                  ? `Soma em aberto (${formatCurrency(installmentSum)}) deve ser ${formatMoneyBr(expectedUnpaidSum)}`
                  : "A soma das parcelas deve ser igual ao total da venda"}
              </p>
            )}
          </Card>
        )}

        <Card>
          <Input
            label="Observação"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-4 flex gap-3">
            <Button
              type="submit"
              disabled={
                loading ||
                totalBelowPaid ||
                (!allPaid && installmentMismatch) ||
                (!allPaid && totalValue <= 0)
              }
            >
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Link href={`/vendas/${sale.id}`}>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
          </div>
        </Card>
      </form>
    </AppLayout>
  );
}
