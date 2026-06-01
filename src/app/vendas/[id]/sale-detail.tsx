"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentButton } from "@/components/payments/payment-modal";
import { deleteSale, forceDeleteSale } from "@/actions/sales";
import { cancelPayment } from "@/actions/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

interface SaleDetailProps {
  sale: {
    id: string;
    type: string;
    description: string | null;
    saleDate: Date;
    notes: string | null;
    totalValue: unknown;
    client: { id: string; name: string };
    items: {
      id: string;
      name: string;
      quantity: number;
      unitPrice: unknown;
      totalPrice: unknown;
    }[];
    installments: {
      id: string;
      number: number;
      value: unknown;
      dueDate: Date;
      status: string;
      payment: { paymentDate: Date } | null;
    }[];
  };
}

export function SaleDetail({ sale }: SaleDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasPaidInstallments = sale.installments.some((i) => i.status === "PAID");

  async function handleCancelPayment(installmentId: number | string) {
    const confirmed = confirm(
      "Deseja realmente estornar este recebimento? A parcela voltará ao status pendente."
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    const result = await cancelPayment(String(installmentId));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  async function handleDelete() {
    if (hasPaidInstallments) {
      const confirmed = confirm(
        "Esta venda possui parcelas pagas. Deseja realmente excluir? O histórico financeiro será preservado via exclusão lógica."
      );
      if (!confirmed) return;

      setLoading(true);
      const result = await forceDeleteSale(sale.id);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    } else {
      if (!confirm("Deseja realmente excluir esta venda?")) return;

      setLoading(true);
      const result = await deleteSale(sale.id);
      if (result?.error && !result.requiresConfirmation) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (result?.requiresConfirmation) {
        setLoading(false);
        return;
      }
    }

    router.push("/vendas");
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/vendas"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
        <div className="flex gap-2">
          <Link href={`/vendas/${sale.id}/editar`}>
            <Button variant="secondary" size="sm">
              <Pencil className="mr-1 h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>
            <Trash2 className="mr-1 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Venda — {formatDate(sale.saleDate)}
              </h1>
              <Link
                href={`/clientes/${sale.client.id}`}
                className="mt-1 text-sm text-primary-600 hover:underline"
              >
                {sale.client.name}
              </Link>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {sale.type === "ITEMS" ? "Por itens" : "Valor direto"}
            </span>
          </div>

          {sale.description && (
            <p className="mt-4 text-slate-700">{sale.description}</p>
          )}

          {sale.notes && (
            <p className="mt-2 text-sm text-slate-500">{sale.notes}</p>
          )}
        </Card>

        <Card>
          <p className="text-sm font-medium text-slate-500">Valor Total</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {formatCurrency(Number(sale.totalValue))}
          </p>
        </Card>
      </div>

      {sale.type === "ITEMS" && sale.items.length > 0 && (
        <Card title="Itens" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Item</th>
                  <th className="pb-3 font-medium">Qtd</th>
                  <th className="pb-3 font-medium">Valor Unit.</th>
                  <th className="pb-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="py-3 text-slate-600">{item.quantity}</td>
                    <td className="py-3 text-slate-600">
                      {formatCurrency(Number(item.unitPrice))}
                    </td>
                    <td className="py-3 font-medium text-slate-800">
                      {formatCurrency(Number(item.totalPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Parcelas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Valor</th>
                <th className="pb-3 font-medium">Vencimento</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Pagamento</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sale.installments.map((inst) => (
                <tr key={inst.id} className="border-b border-slate-100">
                  <td className="py-3 text-slate-600">{inst.number}</td>
                  <td className="py-3 font-medium text-slate-800">
                    {formatCurrency(Number(inst.value))}
                  </td>
                  <td className="py-3 text-slate-600">{formatDate(inst.dueDate)}</td>
                  <td className="py-3">
                    <StatusBadge status={inst.status} />
                  </td>
                  <td className="py-3 text-slate-600">
                    {inst.payment
                      ? formatDate(inst.payment.paymentDate)
                      : "—"}
                  </td>
                  <td className="py-3">
                    {(inst.status === "PENDING" || inst.status === "OVERDUE") && (
                      <PaymentButton
                        installment={{
                          id: inst.id,
                          number: inst.number,
                          value: Number(inst.value),
                          dueDate: new Date(inst.dueDate).toISOString(),
                          clientName: sale.client.name,
                          saleId: sale.id,
                        }}
                      />
                    )}
                    {inst.status === "PAID" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelPayment(inst.id)}
                        disabled={loading}
                      >
                        Estornar
                      </Button>
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
