"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { createSale } from "@/actions/sales";
import {
  calcItemTotal,
  calcSaleTotalFromItems,
  generateAutoInstallments,
  roundMoney,
} from "@/lib/sale-utils";
import type { CreateSaleInput, SaleItemInput } from "@/lib/schemas";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SaleFormProps {
  clients: { id: string; name: string }[];
}

type SaleType = "ITEMS" | "DIRECT_VALUE";
type PaymentType = "CASH" | "INSTALLMENT";
type InstallmentMode = "AUTO" | "MANUAL";

const emptyItem = (): SaleItemInput => ({
  name: "",
  quantity: 1,
  unitPrice: 0,
});

export function SaleForm({ clients }: SaleFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("ITEMS");
  const [description, setDescription] = useState("");
  const [directValue, setDirectValue] = useState("");
  const [items, setItems] = useState<SaleItemInput[]>([emptyItem()]);

  const [paymentType, setPaymentType] = useState<PaymentType>("INSTALLMENT");
  const [installmentMode, setInstallmentMode] = useState<InstallmentMode>("AUTO");
  const [installmentCount, setInstallmentCount] = useState("3");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [manualInstallments, setManualInstallments] = useState<
    { value: string; dueDate: string }[]
  >([{ value: "", dueDate: "" }]);

  const totalValue = useMemo(() => {
    if (saleType === "DIRECT_VALUE") {
      return roundMoney(parseFloat(directValue) || 0);
    }
    return calcSaleTotalFromItems(
      items.map((i) => ({
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
      }))
    );
  }, [saleType, directValue, items]);

  const previewInstallments = useMemo(() => {
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
    paymentType,
    totalValue,
    saleDate,
    installmentMode,
    installmentCount,
    firstDueDate,
    manualInstallments,
  ]);

  const installmentSum = previewInstallments.reduce((s, i) => s + i.value, 0);
  const installmentMismatch =
    paymentType === "INSTALLMENT" &&
    previewInstallments.length > 0 &&
    Math.abs(installmentSum - totalValue) >= 0.01;

  function updateItem(index: number, field: keyof SaleItemInput, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function distributeManualInstallments() {
    const count = manualInstallments.length;
    if (count === 0 || totalValue <= 0) return;
    const generated = generateAutoInstallments(
      totalValue,
      count,
      firstDueDate || saleDate
    );
    setManualInstallments(
      generated.map((g) => ({ value: g.value.toFixed(2), dueDate: g.dueDate }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload: CreateSaleInput = {
      clientId,
      type: saleType,
      saleDate,
      notes: notes || undefined,
      description: saleType === "DIRECT_VALUE" ? description : undefined,
      directValue: saleType === "DIRECT_VALUE" ? parseFloat(directValue) : undefined,
      items:
        saleType === "ITEMS"
          ? items.map((i) => ({
              name: i.name,
              quantity: Number(i.quantity),
              unitPrice: Number(i.unitPrice),
            }))
          : undefined,
      paymentType,
      installmentMode: paymentType === "INSTALLMENT" ? installmentMode : undefined,
      installmentCount:
        paymentType === "INSTALLMENT" && installmentMode === "AUTO"
          ? parseInt(installmentCount)
          : undefined,
      firstDueDate:
        paymentType === "INSTALLMENT" && installmentMode === "AUTO"
          ? firstDueDate
          : undefined,
      installments:
        paymentType === "INSTALLMENT" && installmentMode === "MANUAL"
          ? manualInstallments
              .filter((i) => i.value && i.dueDate)
              .map((inst, index) => ({
                number: index + 1,
                value: parseFloat(inst.value),
                dueDate: inst.dueDate,
              }))
          : undefined,
    };

    const result = await createSale(payload);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/vendas/${result.saleId}`);
      router.refresh();
    }
  }

  if (clients.length === 0) {
    return (
      <AppLayout>
        <Card className="mx-auto max-w-lg text-center">
          <p className="text-slate-600">
            Cadastre um cliente antes de registrar uma venda.
          </p>
          <Link href="/clientes/novo" className="mt-4 inline-block">
            <Button>Cadastrar Cliente</Button>
          </Link>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href="/vendas"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <h1 className="mb-6 text-xl font-bold text-slate-900">Nova Venda</h1>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Cliente *"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Selecione o cliente"
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

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Modalidade *
            </label>
            <div className="flex gap-3">
              {(["ITEMS", "DIRECT_VALUE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSaleType(type)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    saleType === type
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {type === "ITEMS" ? "Por Itens" : "Valor Direto"}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title={saleType === "ITEMS" ? "Itens da Venda" : "Valor da Venda"}>
          {saleType === "DIRECT_VALUE" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Descrição *"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Serviço de manutenção"
                required
              />
              <Input
                label="Valor Total *"
                type="number"
                step="0.01"
                min="0.01"
                value={directValue}
                onChange={(e) => setDirectValue(e.target.value)}
                placeholder="0,00"
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
                      placeholder="Nome do item"
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
                    <span className="font-medium text-slate-800">
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
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
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
            </div>
          </div>
        </Card>

        <Card title="Pagamento">
          <div className="mb-4 flex gap-3">
            {(["CASH", "INSTALLMENT"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPaymentType(type)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  paymentType === type
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {type === "CASH" ? "À Vista" : "Parcelada"}
              </button>
            ))}
          </div>

          {paymentType === "INSTALLMENT" && (
            <>
              <div className="mb-4 flex gap-3">
                {(["AUTO", "MANUAL"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInstallmentMode(mode)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      installmentMode === mode
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {mode === "AUTO" ? "Automático" : "Manual"}
                  </button>
                ))}
              </div>

              {installmentMode === "AUTO" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Quantidade de Parcelas *"
                    type="number"
                    min="1"
                    max="120"
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
              ) : (
                <div className="space-y-3">
                  {manualInstallments.map((inst, index) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-12">
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
                      <div className="sm:col-span-1 flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setManualInstallments((prev) =>
                              prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
                            )
                          }
                          disabled={manualInstallments.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={distributeManualInstallments}
                    >
                      Distribuir igualmente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {previewInstallments.length > 0 && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Prévia das Parcelas
              </p>
              <div className="space-y-1">
                {previewInstallments.map((inst) => (
                  <div
                    key={inst.number}
                    className="flex justify-between text-sm text-slate-600"
                  >
                    <span>
                      Parcela {inst.number} — {inst.dueDate.split("-").reverse().join("/")}
                    </span>
                    <span>{formatCurrency(inst.value)}</span>
                  </div>
                ))}
              </div>
              {installmentMismatch && (
                <p className="mt-2 text-xs text-red-600">
                  Soma das parcelas ({formatCurrency(installmentSum)}) difere do total (
                  {formatCurrency(totalValue)})
                </p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <Input
            label="Observação"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações adicionais..."
          />

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <Button
              type="submit"
              disabled={loading || totalValue <= 0 || installmentMismatch}
            >
              {loading ? "Salvando..." : "Registrar Venda"}
            </Button>
            <Link href="/vendas">
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
