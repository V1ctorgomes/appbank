import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Calendar, ArrowRight, CheckCircle2 } from "lucide-react";
import { getRoutinesForDate } from "@/actions/routines";
import { RoutineIcon } from "@/components/routines/routine-icon";

export async function RoutineWidget() {
  let routineData = { summary: { total: 0, completed: 0, percentage: 0 }, items: [] };
  try {
    routineData = await getRoutinesForDate();
  } catch (err) {
    console.error("Erro no RoutineWidget:", err);
  }
  const { summary, items } = routineData;

  if (summary.total === 0) {
    return (
      <Card title="Rotina de Hoje">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="rounded-full bg-blue-50 p-3 text-blue-600 mb-2">
            <Calendar className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-800">Nenhuma rotina para hoje</p>
          <p className="text-xs text-slate-500 mb-4">
            Monte seu cronograma com horários e descansos.
          </p>
          <Link
            href="/rotina"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Configurar Rotina <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">Rotina de Hoje</h3>
        </div>
        <Link
          href="/rotina"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          Ver tudo ({summary.completed}/{summary.total}) <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600">
          <span>{summary.completed} de {summary.total} concluídas</span>
          <span className="font-bold text-slate-900">{summary.percentage}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              summary.percentage >= 100 ? "bg-emerald-500" : "bg-blue-600"
            }`}
            style={{ width: `${summary.percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {items.slice(0, 3).map((item: any) => (
          <div
            key={item.id}
            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
              item.status === "COMPLETED"
                ? "border-emerald-100 bg-emerald-50/40 text-slate-500"
                : "border-slate-100 bg-slate-50/50 text-slate-800 font-medium"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <RoutineIcon name={item.icon} type={item.type} isAdHoc={item.isAdHoc} className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className={`truncate ${item.status === "COMPLETED" ? "line-through" : ""}`}>
                {item.title}
              </span>
            </div>

            {item.startTime && (
              <span className="text-[11px] text-slate-500 font-normal flex-shrink-0">
                {item.startTime}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
