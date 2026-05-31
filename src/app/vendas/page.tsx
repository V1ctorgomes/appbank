import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { SaleStatusBadge } from "@/components/ui/status-badge";
import { getSales } from "@/actions/sales";
import { getSalePaymentSummary } from "@/lib/sale-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Eye } from "lucide-react";

export default async function VendasPage() {
  const sales = await getSales();

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendas</h1>
          <p className="text-slate-500">{sales.length} venda(s) registrada(s)</p>
        </div>
        <Link href="/vendas/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Venda
          </Button>
        </Link>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-500">Nenhuma venda registrada.</p>
          <Link href="/vendas/nova" className="mt-4 inline-block">
            <Button>Registrar primeira venda</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium">Tipo</th>
                  <th className="px-6 py-3 font-medium">Valor</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const summary = getSalePaymentSummary(sale.installments);
                  return (
                    <tr key={sale.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {sale.client.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {sale.type === "ITEMS" ? "Por itens" : "Valor direto"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {formatCurrency(Number(sale.totalValue))}
                      </td>
                      <td className="px-6 py-4">
                        <SaleStatusBadge {...summary} />
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/vendas/${sale.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-4 w-4" />
                            Ver
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
