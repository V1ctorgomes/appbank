import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { getClients } from "@/actions/clients";
import { getClientBalance } from "@/lib/client-utils";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatCurrency, formatPhone, formatCpf } from "@/lib/utils";
import { Plus, Eye } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { items: clients, total, page, totalPages } = await getClients(
    undefined,
    params.page
  );

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500">
            {total} cliente(s) · página {page} de {totalPages}
          </p>
        </div>
        <Link href="/clientes/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </Link>
      </div>

      {total === 0 ? (
        <Card>
          <p className="text-center text-slate-500">
            Nenhum cliente cadastrado.{" "}
            <Link href="/clientes/novo" className="text-primary-600 hover:underline">
              Cadastre o primeiro
            </Link>
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Nome</th>
                  <th className="px-6 py-3 font-medium">Telefone</th>
                  <th className="px-6 py-3 font-medium">CPF</th>
                  <th className="px-6 py-3 font-medium">Saldo Devedor</th>
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const balance = getClientBalance(client);
                  return (
                    <tr key={client.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 font-medium text-slate-800">{client.name}</td>
                      <td className="px-6 py-4 text-slate-600">{formatPhone(client.phone)}</td>
                      <td className="px-6 py-4 text-slate-600">{formatCpf(client.cpf)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={
                            balance > 0 ? "font-medium text-amber-700" : "text-slate-400"
                          }
                        >
                          {formatCurrency(balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/clientes/${client.id}`}>
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
              basePath="/clientes"
            />
            <p className="mt-2 text-xs text-slate-400">
              Exibindo até {PAGE_SIZE} clientes por página
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
