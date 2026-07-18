"use client";

import { useState } from "react";
import { lookupClientByCpf, type PortalClientData } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, formatCpf } from "@/lib/utils";
import { formatPaymentSchedule } from "@/lib/loan-utils";
import { Search } from "lucide-react";

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function ConsultaResult({ data }: { data: PortalClientData }) {
  const openInstallments = data.sales.flatMap((sale) =>
    sale.installments
      .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
      .map((i) => ({ ...i, saleDate: sale.saleDate }))
  );

  const hasOpenSales = openInstallments.length > 0;
  const hasLoans = data.loans.length > 0;
  const hasNothingOpen = !hasOpenSales && !hasLoans;

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-primary-100 bg-primary-50 p-4 text-center">
        <p className="text-sm text-primary-800">Olá,</p>
        <p className="text-xl font-bold text-primary-900">{data.clientName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-sm text-slate-500">Total em aberto</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">
            {formatCurrency(data.totalDebt)}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-slate-500">Parcelas atrasadas</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{data.overdueCount}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-slate-500">Próximo vencimento</p>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {data.nextDueDate ? formatDate(data.nextDueDate) : "—"}
          </p>
        </Card>
      </div>

      {data.totalPaid > 0 && (
        <p className="text-center text-sm text-slate-600">
          Total já pago (vendas):{" "}
          <span className="font-semibold text-green-700">
            {formatCurrency(data.totalPaid)}
          </span>
        </p>
      )}

      {hasLoans && (
        <Card title="Empréstimos em aberto">
          <div className="space-y-4">
            {data.loans.map((loan, idx) => (
              <div key={idx} className="rounded-lg border border-slate-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">
                      Empréstimo — {formatDate(loan.loanDate)}
                    </p>
                    <p className="text-sm text-slate-500">
                      Principal {formatCurrency(loan.principal)} · Juros {loan.interestRate}%
                      a.m. · {formatPaymentSchedule(loan.paymentDay, loan.billingStartMonth)}
                    </p>
                  </div>
                  <StatusBadge status={loan.status} />
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Saldo da dívida</dt>
                    <dd className="font-semibold text-slate-900">
                      {formatCurrency(loan.remainingBalance)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Juros do mês</dt>
                    <dd className="font-semibold text-amber-700">
                      {formatCurrency(loan.monthlyInterest)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Para quitar agora</dt>
                    <dd className="font-semibold text-slate-900">
                      {formatCurrency(loan.settleTotal)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Próximo vencimento</dt>
                    <dd className="font-semibold text-slate-900">
                      {formatDate(loan.nextDueDate)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </Card>
      )}

      {hasOpenSales ? (
        <Card title="Parcelas em aberto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Parcela</th>
                  <th className="pb-3 font-medium">Valor</th>
                  <th className="pb-3 font-medium">Vencimento</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {openInstallments.map((inst, idx) => (
                  <tr key={`${inst.number}-${inst.dueDate}-${idx}`} className="border-b border-slate-100">
                    <td className="py-3">#{inst.number}</td>
                    <td className="py-3 font-medium">{formatCurrency(inst.value)}</td>
                    <td className="py-3">{formatDate(inst.dueDate)}</td>
                    <td className="py-3">
                      <StatusBadge status={inst.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {hasNothingOpen && (
        <Card>
          <p className="text-center text-sm text-green-700">
            Você não possui parcelas nem empréstimos em aberto no momento.
          </p>
        </Card>
      )}

      {data.sales.length > 0 && (
        <Card title="Detalhamento por venda">
          <div className="space-y-4">
            {data.sales.map((sale, saleIdx) => (
              <div key={saleIdx} className="rounded-lg border border-slate-100 p-4">
                <p className="font-medium text-slate-800">
                  Venda — {formatDate(sale.saleDate)}
                </p>
                <p className="text-sm text-slate-500">
                  {sale.description || "Sem descrição"} ·{" "}
                  {formatCurrency(sale.totalValue)}
                </p>
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
                        <tr key={inst.number} className="border-t border-slate-50">
                          <td className="py-2">#{inst.number}</td>
                          <td className="py-2">{formatCurrency(inst.value)}</td>
                          <td className="py-2">{formatDate(inst.dueDate)}</td>
                          <td className="py-2">
                            <StatusBadge status={inst.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function CpfConsulta() {
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PortalClientData | null>(null);
  const [searchedCpf, setSearchedCpf] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const result = await lookupClientByCpf(cpf);

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setResult(result.data);
    setSearchedCpf(cpf);
    setLoading(false);
  }

  function handleNewSearch() {
    setResult(null);
    setError("");
    setSearchedCpf("");
  }

  return (
    <>
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="CPF"
            name="cpf"
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            required
            autoComplete="off"
            inputMode="numeric"
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Consultando..." : "Consultar"}
          </Button>
        </form>
      </Card>

      {result && (
        <div className="w-full max-w-2xl">
          <p className="mb-4 text-center text-xs text-slate-500">
            Consulta para CPF {formatCpf(searchedCpf.replace(/\D/g, ""))}
            {" · "}
            <button
              type="button"
              onClick={handleNewSearch}
              className="text-primary-600 hover:underline"
            >
              Nova consulta
            </button>
          </p>
          <ConsultaResult data={result} />
        </div>
      )}
    </>
  );
}
