import { AppLayout } from "@/components/layout/app-layout";
import { StatCard, Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDashboardData } from "@/actions/dashboard";
import { GoalsWidget } from "@/components/dashboard/goals-widget";
import { RoutineWidget } from "@/components/dashboard/routine-widget";

export default async function DashboardPage() {
  let data: any = {
    balance: 0,
    monthIncome: 0,
    monthExpense: 0,
    totalReceivable: 0,
    overdueCount: 0,
    upcomingPayments: [],
  };

  try {
    data = await getDashboardData();
  } catch (err) {
    console.error("Erro ao carregar dados do dashboard:", err);
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Visão geral da sua situação financeira</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Saldo Atual"
          value={formatCurrency(data.balance)}
          variant={data.balance >= 0 ? "income" : "expense"}
        />
        <StatCard
          title="Entradas do Mês"
          value={formatCurrency(data.monthIncome)}
          variant="income"
        />
        <StatCard
          title="Saídas do Mês"
          value={formatCurrency(data.monthExpense)}
          variant="expense"
        />
        <StatCard
          title="A Receber no Mês"
          value={formatCurrency(data.totalReceivable)}
          subtitle="Vencimentos do mês atual"
        />
        <StatCard
          title="Parcelas Atrasadas"
          value={String(data.overdueCount)}
          variant={data.overdueCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Próximos Recebimentos">
            {data.upcomingPayments.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum recebimento previsto nos próximos 30 dias.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="pb-3 font-medium">Cliente</th>
                      <th className="pb-3 font-medium">Valor</th>
                      <th className="pb-3 font-medium">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcomingPayments.map((payment: any) => (
                      <tr key={payment.id} className="border-b border-slate-100">
                        <td className="py-3 font-medium text-slate-800">{payment.clientName}</td>
                        <td className="py-3 text-green-700">{formatCurrency(payment.value)}</td>
                        <td className="py-3 text-slate-600">{formatDate(payment.dueDate)}</td>
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

