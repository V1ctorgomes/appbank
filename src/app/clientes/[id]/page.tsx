import { notFound } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getClient } from "@/actions/clients";
import { formatCurrency, formatDate, formatPhone, formatCpf } from "@/lib/utils";
import { ArrowLeft, Pencil } from "lucide-react";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) notFound();

  let totalDebt = 0;
  for (const sale of client.sales) {
    for (const inst of sale.installments) {
      if (inst.status === "PENDING" || inst.status === "OVERDUE") {
        totalDebt += Number(inst.value);
      }
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/clientes"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
        <Link href={`/clientes/${id}/editar`}>
          <Button variant="secondary" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            Editar
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">Telefone</dt>
              <dd className="text-slate-700">{formatPhone(client.phone)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-400">CPF</dt>
              <dd className="text-slate-700">{formatCpf(client.cpf)}</dd>
            </div>
            {client.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase text-slate-400">Observações</dt>
                <dd className="text-slate-700">{client.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <p className="text-sm font-medium text-slate-500">Saldo Devedor</p>
          <p className="mt-1 text-3xl font-bold text-amber-700">{formatCurrency(totalDebt)}</p>
        </Card>
      </div>

      <Card title="Histórico de Vendas">
        {client.sales.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma venda registrada para este cliente.</p>
        ) : (
          <div className="space-y-4">
            {client.sales.map((sale) => (
              <div key={sale.id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">
                      Venda — {formatDate(sale.saleDate)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {sale.type === "ITEMS" ? "Por itens" : "Valor direto"} ·{" "}
                      {formatCurrency(Number(sale.totalValue))}
                    </p>
                  </div>
                </div>

                {sale.installments.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="pb-2">Parcela</th>
                          <th className="pb-2">Valor</th>
                          <th className="pb-2">Vencimento</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.installments.map((inst) => (
                          <tr key={inst.id} className="border-t border-slate-50">
                            <td className="py-2">{inst.number}</td>
                            <td className="py-2">{formatCurrency(Number(inst.value))}</td>
                            <td className="py-2">{formatDate(inst.dueDate)}</td>
                            <td className="py-2">
                              <StatusBadge status={inst.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
