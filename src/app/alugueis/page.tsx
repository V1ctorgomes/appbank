import { Suspense } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListSearch } from "@/components/ui/list-search";
import { RentalStatusFilter } from "@/components/rentals/rental-status-filter";
import { getRentals } from "@/actions/rentals";
import {
  formatRentalSchedule,
  parseRentalListStatus,
  rentalFrequencyLabel,
} from "@/lib/rental-utils";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Eye, Pencil, Plus } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

export default async function AlugueisPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const status = parseRentalListStatus(params.status);
  const { items, total, page, totalPages } = await getRentals(
    params.page,
    search,
    status
  );
  const statusParam = status === "ativos" ? undefined : status;

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aluguéis</h1>
          <p className="text-slate-500">
            Motos com intenção de compra · {total} contrato(s)
          </p>
        </div>
        <Link href="/alugueis/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo aluguel
          </Button>
        </Link>
      </div>

      <div className="mb-4">
        <Suspense fallback={null}>
          <RentalStatusFilter current={status} search={search} />
        </Suspense>
      </div>

      <ListSearch
        action="/alugueis"
        defaultValue={search}
        placeholder="Buscar por cliente, moto, placa ou observação"
        hiddenFields={{ status: statusParam }}
        clearHref={status === "ativos" ? "/alugueis" : `/alugueis?status=${status}`}
      />

      {total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-500">Nenhum aluguel encontrado.</p>
          <Link href="/alugueis/novo" className="mt-4 inline-block">
            <Button>Cadastrar primeiro aluguel</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Início</th>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium">Veículo</th>
                  <th className="px-6 py-3 font-medium">Parcelas</th>
                  <th className="px-6 py-3 font-medium">Em aberto</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((rental) => (
                  <tr key={rental.id} className="border-t border-slate-100">
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(rental.startDate)}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {rental.client.name}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div>{rental.vehicleDescription}</div>
                      {rental.plate && (
                        <div className="text-xs text-slate-400">{rental.plate}</div>
                      )}
                      <div className="text-xs text-slate-400">
                        {rentalFrequencyLabel(rental.paymentFrequency)} ·{" "}
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
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {rental.paidCount}/{rental.installmentCount} ×{" "}
                      {formatCurrency(Number(rental.installmentValue))}
                      <div className="text-xs text-slate-400">
                        Total {formatCurrency(Number(rental.totalValue))}
                      </div>
                      {rental.vehicleCost == null ? (
                        <div className="text-xs font-medium text-amber-600">
                          Custo da moto não informado
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          Custo {formatCurrency(Number(rental.vehicleCost))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {formatCurrency(rental.openValue)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={rental.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <Link href={`/alugueis/${rental.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-4 w-4" />
                            Ver
                          </Button>
                        </Link>
                        <Link href={`/alugueis/${rental.id}/editar`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="mr-1 h-4 w-4" />
                            Editar
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/alugueis"
              searchParams={{ search, status: statusParam }}
            />
            <p className="mt-2 text-xs text-slate-400">
              Até {PAGE_SIZE} por página
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
