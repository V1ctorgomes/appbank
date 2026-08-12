"use client";

import { useState } from "react";
import { formatCurrency, formatDate, formatDateForInput } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  HandCoins,
  TrendingUp,
  Plane,
  Flame,
  CheckSquare,
  Check,
  X as XIcon,
} from "lucide-react";
import { toggleGoalCompletion, deleteGoal, toggleGoalDailyCheckin } from "@/actions/goals";

interface GoalCardProps {
  goal: {
    id: string;
    title: string;
    description?: string | null;
    type: "LOAN_COUNT" | "LOAN_PORTFOLIO" | "LOAN_MONTHLY_GROWTH" | "SAVINGS_TARGET" | "EXPENSE_STREAK" | "MANUAL_CHECKLIST";
    targetAmount?: number | null;
    currentAmount?: number | null;
    targetCount?: number | null;
    currentCount?: number | null;
    targetDays?: number | null;
    selectedDays?: string | null;
    startDate?: Date | string | null;
    targetDate?: Date | string | null;
    targetDate?: Date | string | null;
    checkIns?: string | null;
    isCompleted: boolean;
  onEdit: (goal: any) => void;
}

const formatWeekdays = (selectedDaysStr?: string | null) => {
  if (!selectedDaysStr) return null;
  const daysMap: Record<string, string> = {
    "1": "Seg",
    "2": "Ter",
    "3": "Qua",
    "4": "Qui",
    "5": "Sex",
    "6": "Sáb",
    "0": "Dom",
  };
  const parts = selectedDaysStr.split(",").map((s) => s.trim());
  if (parts.length === 5 && ["1", "2", "3", "4", "5"].every((d) => parts.includes(d))) return "Segunda a Sexta";
  if (parts.length === 2 && ["0", "6"].every((d) => parts.includes(d))) return "Finais de Semana";
  if (parts.length === 7) return "Todos os Dias";
  return parts.map((p) => daysMap[p] ?? p).join(", ");
};

export function GoalCard({ goal, onEdit }: GoalCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleToggle = async () => {
    try {
      setIsToggling(true);
      await toggleGoalCompletion(goal.id);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Deseja realmente excluir a meta "${goal.title}"?`)) return;
    try {
      setIsDeleting(true);
      await deleteGoal(goal.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCheckin = async (dateStr: string, status?: boolean) => {
    try {
      setIsCheckingIn(true);
      await toggleGoalDailyCheckin(goal.id, dateStr, status);
    } finally {
      setIsCheckingIn(false);
    }
  };

  let checkInsMap: Record<string, boolean> = {};
  try {
    if (goal.checkIns) {
      checkInsMap = JSON.parse(goal.checkIns);
    }
  } catch (e) {
    checkInsMap = {};
  }

  const todayStr = formatDateForInput(new Date());

  const recentDaysList = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDateForInput(d);
    const weekdaysShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    recentDaysList.push({
      dateStr,
      weekday: weekdaysShort[d.getDay()],
      dayNum: d.getDate(),
    });
  }

  const todayStrFormatted = formatDate(new Date());
  const startDateStr = goal.startDate ? formatDateForInput(new Date(goal.startDate)) : null;
  const isFutureGoal = startDateStr && startDateStr > todayStr;

  // Cálculo da porcentagem de progresso
  let percent = 0;
  let progressText = "";

  if (goal.isCompleted) {
    percent = 100;
  } else if (isFutureGoal) {
    percent = 0;
    progressText = `Inicia em ${formatDate(goal.startDate!)} · ${goal.currentCount ?? 0} de ${goal.targetDays ?? goal.targetCount ?? 0} concluídos`;
  } else if (goal.type === "LOAN_COUNT" && goal.targetCount) {
    const cur = goal.currentCount ?? 0;
    percent = Math.min(100, Math.round((cur / goal.targetCount) * 100));
    progressText = `${cur} de ${goal.targetCount} empréstimos simultâneos`;
  } else if (goal.type === "LOAN_PORTFOLIO" && goal.targetAmount) {
    const cur = goal.currentAmount ?? 0;
    percent = Math.min(100, Math.round((cur / goal.targetAmount) * 100));
    progressText = `${formatCurrency(cur)} de ${formatCurrency(goal.targetAmount)} em carteira`;
  } else if (goal.type === "SAVINGS_TARGET" && goal.targetAmount) {
    const cur = goal.currentAmount ?? 0;
    percent = Math.min(100, Math.round((cur / goal.targetAmount) * 100));
    progressText = `${formatCurrency(cur)} de ${formatCurrency(goal.targetAmount)}`;
  } else if (goal.type === "EXPENSE_STREAK" && goal.targetDays) {
    const cur = goal.currentCount ?? 0;
    percent = Math.min(100, Math.round((cur / goal.targetDays) * 100));
    progressText = `${cur} de ${goal.targetDays} dias sem despesas`;
  } else if (goal.type === "MANUAL_CHECKLIST" && goal.targetDays) {
    const cur = goal.currentCount ?? 0;
    percent = Math.min(100, Math.round((cur / goal.targetDays) * 100));
    progressText = `${cur} de ${goal.targetDays} dias marcados`;
  } else {
    percent = goal.isCompleted ? 100 : 0;
    progressText = goal.isCompleted ? "Concluída!" : "Pendente";
  }

  // Tipo badge config
  const getTypeInfo = () => {
    switch (goal.type) {
      case "LOAN_COUNT":
        return {
          label: "Empréstimos Simultâneos",
          icon: HandCoins,
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "LOAN_PORTFOLIO":
        return {
          label: "Valor em Carteira",
          icon: TrendingUp,
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "SAVINGS_TARGET":
        return {
          label: "Meta / Viagem",
          icon: Plane,
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "EXPENSE_STREAK":
        return {
          label: "Dias Sem Gastar",
          icon: Flame,
          badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        };
      default:
        return {
          label: "Meta Manual",
          icon: CheckSquare,
          badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  const typeInfo = getTypeInfo();
  const TypeIcon = typeInfo.icon;

  return (
    <div
      className={`group relative rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md ${goal.isCompleted
          ? "border-emerald-200 bg-emerald-50/20"
          : "border-slate-200 hover:border-blue-300"
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Checkbox & Title */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleToggle}
            disabled={isToggling}
            className="mt-0.5 text-slate-400 transition-transform hover:scale-110 focus:outline-none"
            title={goal.isCompleted ? "Marcar como pendente" : "Marcar como concluída"}
          >
            {goal.isCompleted ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 fill-emerald-100" />
            ) : (
              <Circle className="h-6 w-6 text-slate-300 hover:text-blue-600" />
            )}
          </button>

          <div>
            <h3
              className={`font-semibold text-slate-900 ${goal.isCompleted ? "line-through text-slate-500" : ""
                }`}
            >
              {goal.title}
            </h3>
            {goal.description && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {goal.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-7 z-10 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              onMouseLeave={() => setShowMenu(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onEdit(goal);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  handleDelete();
                }}
                disabled={isDeleting}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Meta Badge & Prazo */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeInfo.badgeColor}`}
          >
            <TypeIcon className="h-3.5 w-3.5" />
            {typeInfo.label}
          </span>
          {goal.type === "EXPENSE_STREAK" && goal.selectedDays && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              <Calendar className="h-3 w-3 text-slate-500" />
              {formatWeekdays(goal.selectedDays)}
            </span>
          )}
        </div>

        {(goal.startDate || goal.targetDate) && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {goal.startDate && goal.targetDate
                ? formatDate(goal.startDate) === formatDate(goal.targetDate)
                  ? `Dia ${formatDate(goal.startDate)}`
                  : `${formatDate(goal.startDate)} até ${formatDate(goal.targetDate)}`
                : goal.startDate
                  ? `A partir de ${formatDate(goal.startDate)}`
                  : `Até ${formatDate(goal.targetDate!)}`}
            </span>
          </div>
        )}
      </div>

      {/* Daily Check-in UI para MANUAL_CHECKLIST */}
      {goal.type === "MANUAL_CHECKLIST" && !isFutureGoal && (
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4 text-blue-600" />
              Check-in de Hoje ({todayStrFormatted})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isCheckingIn}
                onClick={() => handleCheckin(todayStr, true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  checkInsMap[todayStr] === true
                    ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                Consegui
              </button>
              <button
                type="button"
                disabled={isCheckingIn}
                onClick={() => handleCheckin(todayStr, false)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  checkInsMap[todayStr] === false
                    ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-300"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                }`}
              >
                <XIcon className="h-3.5 w-3.5" />
                Não consegui
              </button>
            </div>
          </div>

          {/* Histórico dos últimos 7 dias */}
          <div className="pt-2 border-t border-slate-200/60">
            <p className="text-[10px] uppercase font-bold text-slate-600 mb-1.5">Últimos 7 dias:</p>
            <div className="flex items-center justify-between gap-1">
              {recentDaysList.map((d) => {
                const status = checkInsMap[d.dateStr];
                const isToday = d.dateStr === todayStr;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    disabled={isCheckingIn}
                    onClick={() => handleCheckin(d.dateStr)}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[11px] font-medium transition-all flex-1 ${
                      status === true
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
                        : status === false
                        ? "bg-rose-100 text-rose-800 border border-rose-300 font-bold"
                        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                    } ${isToday ? "ring-2 ring-blue-500/50" : ""}`}
                    title={`${d.weekday} (${d.dateStr}): Clique para alterar status`}
                  >
                    <span className="text-[10px] text-slate-500">{d.weekday}</span>
                    <span className="text-xs font-semibold">{d.dayNum}</span>
                    <span className="mt-0.5">
                      {status === true ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : status === false ? (
                        <XIcon className="h-3 w-3 text-rose-600" />
                      ) : (
                        <Circle className="h-3 w-3 text-slate-300" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Metric Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
          <span>{progressText}</span>
          <span className="font-bold text-slate-900">{percent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-500 rounded-full ${goal.isCompleted
                ? "bg-emerald-500"
                : percent >= 75
                  ? "bg-indigo-600"
                  : percent >= 40
                    ? "bg-blue-500"
                    : "bg-amber-500"
              }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
