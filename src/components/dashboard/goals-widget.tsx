import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getGoalsSummary } from "@/actions/goals";
import { Target, ArrowRight, CheckCircle2 } from "lucide-react";

export async function GoalsWidget() {
  let summary: any = { total: 0, completed: 0, inProgress: 0, averageProgress: 0, recentGoals: [] };
  try {
    summary = await getGoalsSummary();
  } catch (err) {
    console.error("Erro no GoalsWidget:", err);
  }

  if (summary.total === 0) {
    return (
      <Card title="Metas & Objetivos">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="rounded-full bg-blue-50 p-3 text-blue-600 mb-2">
            <Target className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-800">Nenhuma meta cadastrada</p>
          <p className="text-xs text-slate-500 mb-4">
            Defina metas de empréstimos simultâneos, economia ou viagens.
          </p>
          <Link
            href="/metas"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Cadastrar primeira meta <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">Minhas Metas</h3>
        </div>
        <Link
          href="/metas"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          Ver todas ({summary.total}) <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="space-y-4">
        {summary.recentGoals.map((goal: any) => {
          let percent = 0;
          let text = "";

          if (goal.isCompleted) {
            percent = 100;
            text = "Concluída";
          } else if (goal.type === "LOAN_COUNT" && goal.targetCount) {
            const cur = goal.currentCount ?? 0;
            percent = Math.min(100, Math.round((cur / goal.targetCount) * 100));
            text = `${cur} de ${goal.targetCount} empréstimos`;
          } else if (goal.type === "LOAN_PORTFOLIO" && goal.targetAmount) {
            const cur = goal.currentAmount ?? 0;
            percent = Math.min(100, Math.round((cur / goal.targetAmount) * 100));
            text = `${formatCurrency(cur)} de ${formatCurrency(goal.targetAmount)}`;
          } else if (goal.type === "SAVINGS_TARGET" && goal.targetAmount) {
            const cur = goal.currentAmount ?? 0;
            percent = Math.min(100, Math.round((cur / goal.targetAmount) * 100));
            text = `${formatCurrency(cur)} de ${formatCurrency(goal.targetAmount)}`;
          } else if (goal.type === "EXPENSE_STREAK" && goal.targetDays) {
            const cur = goal.currentCount ?? 0;
            percent = Math.min(100, Math.round((cur / goal.targetDays) * 100));
            text = `${cur} de ${goal.targetDays} dias sem despesas`;
          } else {
            percent = goal.isCompleted ? 100 : 0;
            text = goal.isCompleted ? "Concluída" : "Pendente";
          }

          return (
            <div key={goal.id} className="rounded-lg border border-slate-100 p-3 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                  {goal.isCompleted && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  )}
                  <span className="truncate">{goal.title}</span>
                </span>
                <span className="text-slate-600 font-bold">{percent}%</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">{text}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    goal.isCompleted ? "bg-emerald-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
