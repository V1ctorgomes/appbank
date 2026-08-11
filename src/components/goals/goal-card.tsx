"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
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
} from "lucide-react";
import { toggleGoalCompletion, deleteGoal } from "@/actions/goals";

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
    isCompleted: boolean;
    completedAt?: Date | string | null;
  };
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

  const todayStr = new Date().toISOString().split("T")[0];
  const startDateStr = goal.startDate ? new Date(goal.startDate).toISOString().split("T")[0] : null;
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
      className={`group relative rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
        goal.isCompleted
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
              className={`font-semibold text-slate-900 ${
                goal.isCompleted ? "line-through text-slate-500" : ""
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
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              📅 {formatWeekdays(goal.selectedDays)}
            </span>
          )}
        </div>

        {(goal.startDate || goal.targetDate) && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {goal.startDate && goal.targetDate
                ? `${formatDate(goal.startDate)} até ${formatDate(goal.targetDate)}`
                : goal.startDate
                ? `A partir de ${formatDate(goal.startDate)}`
                : `Até ${formatDate(goal.targetDate!)}`}
            </span>
          </div>
        )}
      </div>

      {/* Metric Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
          <span>{progressText}</span>
          <span className="font-bold text-slate-900">{percent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              goal.isCompleted
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
