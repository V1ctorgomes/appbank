import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { getLoans } from "@/actions/loans";
import { calcMonthlyInterest } from "@/lib/loan-utils";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Eye } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function EmprestimosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { items: loans, total, page, totalPages } = await getLoans(params.page);

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empréstimos</h1>
          <p className="text-slate-500">
            {total} empréstimo(s) · página {page} de {totalPages}
          </p>
        </div>
        <Link href="/emprestimos/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Empréstimo
          </Button>
        </Link>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-500">Nenhum empréstimo registrado.</p>
          <Link href="/emprestimos/novo" className="mt-4 inline-block">
            <Button>Registrar primeiro empréstimo</Button>
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
                  <th className="px-6 py-3 font-medium">Principal</th>
                  <th className="px-6 py-3 font-medium">Saldo</th>
                  <th className="px-6 py-3 font-medium">Juros/mês</th>
                  <th className="px-6 py-3 font-medium">Dia pgto</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const balance = Number(loan.remainingBalance);
                  const rate = Number(loan.interestRate);
                  const interest = calcMonthlyInterest(balance, rate);
                  return (
                    <tr key={loan.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(loan.loanDate)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {loan.client.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatCurrency(Number(loan.principal))}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {formatCurrency(balance)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {rate}%
                        {loan.status === "ACTIVE" && (
                          <span className="ml-1 text-xs text-slate-400">
                            ({formatCurrency(interest)})
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        Dia {loan.paymentDay}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={loan.status} />
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/emprestimos/${loan.id}`}>
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
          <div className="px-6 pb-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/emprestimos"
            />
            <p className="mt-2 text-xs text-slate-400">
              Exibindo até {PAGE_SIZE} empréstimos por página
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
