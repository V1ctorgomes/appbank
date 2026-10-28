import { Suspense } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard, Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getDashboardCalendar,
  getDashboardData,
  getDashboardLoanData,
  getDashboardSaleData,
  type DashboardCalendarDay,
} from "@/actions/dashboard";
import { GoalsWidget } from "@/components/dashboard/goals-widget";
import { RoutineWidget } from "@/components/dashboard/routine-widget";
import { DashboardReceiptCalendar } from "@/components/dashboard/receipt-calendar";
import { calendarDateKey } from "@/lib/utils";
import {
  DashboardViewFilter,
  type DashboardView,
} from "@/components/dashboard/dashboard-view-filter";

function parseView(value?: string): DashboardView {
  if (value === "emprestimos" || value === "vendas") return value;
  return "geral";
}

function viewSubtitle(view: DashboardView) {
  if (view === "emprestimos") return "Métricas da carteira de empréstimos";
  if (view === "vendas") return "Métricas das vendas e parcelas";
  return "Visão geral da sua situação financeira";
}

function upcomingTitle(view: DashboardView) {
  if (view === "emprestimos") return "Próximos Vencimentos de Empréstimos";
  if (view === "vendas") return "Próximos Vencimentos de Vendas";
  return "Próximos Recebimentos";
}

function upcomingEmpty(view: DashboardView) {
  if (view === "emprestimos") {
    return "Nenhum vencimento de empréstimo nos próximos 30 dias.";
  }
  if (view === "vendas") {
    return "Nenhum vencimento de venda nos próximos 30 dias.";
  }
  return "Nenhum recebimento previsto nos próximos 30 dias.";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string }>;
}) {
  const params = await searchParams;
  const view = parseView(params.visao);

  let general = {
    balance: 0,
    monthIncome: 0,
    monthExpense: 0,
    totalReceivable: 0,
    overdueCount: 0,
    upcomingPayments: [] as {
      id: string;
      clientName: string;
      value: number;
      dueDate: Date | string;
      label?: string;
    }[],
  };

  let sales = {
    monthCount: 0,
    monthSold: 0,
    monthReceived: 0,
    monthReceivable: 0,
    openValue: 0,
    openCount: 0,
    overdueCount: 0,
    overdueValue: 0,
    upcomingPayments: [] as {
      id: string;
      clientName: string;
      value: number;
      dueDate: Date | string;
      label?: string;
    }[],
  };

  let loans = {
    activeCount: 0,
    portfolio: 0,
    monthReceived: 0,
    monthDisbursed: 0,
    monthReceivable: 0,
    overdueCount: 0,
    overdueValue: 0,
    upcomingPayments: [] as {
      id: string;
      clientName: string;
      value: number;
      dueDate: Date | string;
      label?: string;
    }[],
  };

  let calendar = {
    month: calendarDateKey().slice(0, 7),
    days: [] as DashboardCalendarDay[],
  };

  try {
    if (view === "emprestimos") {
      loans = await getDashboardLoanData();
    } else if (view === "vendas") {
      sales = await getDashboardSaleData();
    } else {
      general = await getDashboardData();
    }
    calendar = await getDashboardCalendar(view);
  } catch (err) {
    console.error("Erro ao carregar dados do dashboard:", err);
  }

  const upcoming =
    view === "emprestimos"
      ? loans.upcomingPayments
      : view === "vendas"
        ? sales.upcomingPayments
        : general.upcomingPayments;
  const showKind = view === "emprestimos" || view === "vendas";

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">{viewSubtitle(view)}</p>
        </div>
        <Suspense fallback={null}>
          <DashboardViewFilter current={view} />
        </Suspense>
      </div>

      {view === "vendas" ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Vendas no Mês"
            value={String(sales.monthCount)}
            subtitle="Registradas neste mês"
          />
          <StatCard
            title="Vendido no Mês"
            value={formatCurrency(sales.monthSold)}
          />
          <StatCard
            title="Recebido no Mês"
            value={formatCurrency(sales.monthReceived)}
            variant="income"
          />
          <StatCard
            title="A Receber no Mês"
            value={formatCurrency(sales.monthReceivable)}
            subtitle="Parcelas que vencem no mês"
          />
          <StatCard
            title="Atrasados"
            value={String(sales.overdueCount)}
            subtitle={
              sales.overdueValue > 0
                ? formatCurrency(sales.overdueValue) + " em parcelas"
                : undefined
            }
            variant={sales.overdueCount > 0 ? "warning" : "default"}
          />
        </div>
      ) : view === "emprestimos" ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Empréstimos Ativos"
            value={String(loans.activeCount)}
          />
          <StatCard
            title="Carteira em Aberto"
            value={formatCurrency(loans.portfolio)}
            subtitle="Saldo restante dos ativos"
          />
          <StatCard
            title="Recebido no Mês"
            value={formatCurrency(loans.monthReceived)}
            variant="income"
          />
          <StatCard
            title="A Receber no Mês"
            value={formatCurrency(loans.monthReceivable)}
            subtitle="Juros e parcelas do mês"
          />
          <StatCard
            title="Atrasados"
            value={String(loans.overdueCount)}
            subtitle={
              loans.overdueValue > 0
                ? formatCurrency(loans.overdueValue) + " em parcelas"
                : undefined
            }
            variant={loans.overdueCount > 0 ? "warning" : "default"}
          />
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Saldo Atual"
            value={formatCurrency(general.balance)}
            variant={general.balance >= 0 ? "income" : "expense"}
          />
          <StatCard
            title="Entradas do Mês"
            value={formatCurrency(general.monthIncome)}
            variant="income"
          />
          <StatCard
            title="Saídas do Mês"
            value={formatCurrency(general.monthExpense)}
            variant="expense"
          />
          <StatCard
            title="A Receber no Mês"
            value={formatCurrency(general.totalReceivable)}
            subtitle="Vencimentos do mês atual"
          />
          <StatCard
            title="Parcelas Atrasadas"
            value={String(general.overdueCount)}
            variant={general.overdueCount > 0 ? "warning" : "default"}
          />
        </div>
      )}

      {view === "vendas" && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Em Aberto"
            value={formatCurrency(sales.openValue)}
            subtitle="Parcelas ainda não pagas"
          />
          <StatCard
            title="Vendas em Aberto"
            value={String(sales.openCount)}
            subtitle="Com parcelas pendentes"
          />
        </div>
      )}

      {view === "emprestimos" && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Liberado no Mês"
            value={formatCurrency(loans.monthDisbursed)}
            subtitle="Novos empréstimos"
            variant="expense"
          />
          <StatCard
            title="Resultado do Mês (empréstimos)"
            value={formatCurrency(loans.monthReceived - loans.monthDisbursed)}
            variant={
              loans.monthReceived - loans.monthDisbursed >= 0 ? "income" : "expense"
            }
            subtitle="Recebido − liberado"
          />
        </div>
      )}

      <DashboardReceiptCalendar
        key={view}
        view={view}
        initialMonth={calendar.month}
        initialDays={calendar.days}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={upcomingTitle(view)}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">{upcomingEmpty(view)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="pb-3 font-medium">Cliente</th>
                      {showKind && <th className="pb-3 font-medium">Tipo</th>}
                      <th className="pb-3 font-medium">Valor</th>
                      <th className="pb-3 font-medium">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100">
                        <td className="py-3 font-medium text-slate-800">
                          {payment.clientName}
                        </td>
                        {showKind && (
                          <td className="py-3 text-slate-600">
                            {payment.label ?? "—"}
                          </td>
                        )}
                        <td className="py-3 text-green-700">
                          {formatCurrency(payment.value)}
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatDate(payment.dueDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <GoalsWidget />
          <RoutineWidget />
        </div>
      </div>
    </AppLayout>
  );
}
