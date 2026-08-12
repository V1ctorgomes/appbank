"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  Coffee,
  Zap,
  Target,
  AlertCircle,
  XCircle,
  CalendarDays,
} from "lucide-react";
import { toggleRoutineLog, deleteRoutine, deleteRoutineLog } from "@/actions/routines";
import { RoutineIcon } from "./routine-icon";

interface RoutineCardProps {
  item: {
    id: string;
    routineId: string | null;
    title: string;
    description?: string | null;
    icon?: string | null;
    type: "ACTIVITY" | "BREAK_REST" | "GENERAL";
    period: string;
    daysOfWeek?: string;
    specificDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    isAdHoc: boolean;
    status: string; // COMPLETED, FAILED, UNEXPECTED_EVENT, PENDING
    logId?: string | null;
    notes?: string | null;
  };
  dateStr: string;
  onEdit?: (item: any) => void;
  onRefresh?: () => void;
}

export function RoutineCard({ item, dateStr, onEdit, onRefresh }: RoutineCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState(item.status);
  const [showMenu, setShowMenu] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notesText, setNotesText] = useState(item.notes || "");

  const handleStatusChange = async (targetStatus?: string) => {
    try {
      setIsUpdating(true);
      if (item.isAdHoc && targetStatus === "DELETE") {
        if (item.logId) {
          await deleteRoutineLog(item.logId);
          if (onRefresh) onRefresh();
        }
        return;
      }

      // Optimistic status toggle
      const nextStatus = targetStatus ?? (status === "COMPLETED" ? "PENDING" : "COMPLETED");
      setStatus(nextStatus);

      if (item.routineId) {
        await toggleRoutineLog(item.routineId, dateStr, targetStatus, notesText || undefined);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      // Revert if error
      setStatus(item.status);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (item.isAdHoc) {
      if (item.logId && confirm("Excluir este imprevisto registrado?")) {
        await deleteRoutineLog(item.logId);
        if (onRefresh) onRefresh();
      }
      return;
    }

    if (item.routineId && confirm(`Excluir a rotina "${item.title}"?`)) {
      await deleteRoutine(item.routineId);
      if (onRefresh) onRefresh();
    }
  };

  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";
  const isUnexpected = status === "UNEXPECTED_EVENT" || item.isAdHoc;
  const isBreak = item.type === "BREAK_REST";

  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all duration-200 shadow-sm hover:shadow-md ${
        isCompleted
          ? "border-emerald-200 bg-emerald-50/20"
          : isUnexpected
          ? "border-purple-200 bg-purple-50/20"
          : isBreak
          ? "border-amber-200 bg-amber-50/20"
          : "border-slate-200 bg-white hover:border-blue-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left Side: Icon & Title */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`rounded-lg p-2 flex items-center justify-center text-lg flex-shrink-0 ${
              isCompleted
                ? "bg-emerald-100 text-emerald-700"
                : isUnexpected
                ? "bg-purple-100 text-purple-700"
                : isBreak
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <RoutineIcon name={item.icon} type={item.type} isAdHoc={item.isAdHoc} className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`font-semibold text-sm text-slate-900 truncate ${
                  isCompleted ? "line-through text-slate-500" : ""
                }`}
              >
                {item.title}
              </h3>

              {/* Type Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  isBreak
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : isUnexpected
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {isBreak ? (
                  <>
                    <Coffee className="h-3 w-3" /> Descanso / Pausa
                  </>
                ) : isUnexpected ? (
                  <>
                    <Zap className="h-3 w-3" /> Imprevisto
                  </>
                ) : (
                  <>
                    <Target className="h-3 w-3" /> Atividade
                  </>
                )}
              </span>

              {/* Specific Date Badge */}
              {item.specificDate && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded-md border border-purple-200">
                  <CalendarDays className="h-3 w-3 text-purple-500" />
                  Data: {item.specificDate.split("-").reverse().join("/")}
                </span>
              )}

              {/* Time slot Badge */}
              {(item.startTime || item.endTime) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {item.startTime}
                  {item.endTime ? ` às ${item.endTime}` : ""}
                </span>
              )}
            </div>

            {item.description && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p>
            )}

            {item.notes && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded border border-purple-200">
                <AlertCircle className="h-3 w-3" />
                <span>Nota: {item.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Status Toggles & Options */}
        <div className="flex items-center gap-2">
          {/* Status buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleStatusChange(isCompleted ? "PENDING" : "COMPLETED")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                isCompleted
                  ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300"
                  : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200"
              }`}
              title="Marcar como concluído"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Concluído</span>
            </button>

            {!item.isAdHoc && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange(isUnexpected ? "PENDING" : "UNEXPECTED_EVENT")}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isUnexpected
                    ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-300"
                    : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700 border border-slate-200"
                }`}
                title="Marcar como imprevisto / alterado"
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Imprevisto</span>
              </button>
            )}

            {!item.isAdHoc && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange(isFailed ? "PENDING" : "FAILED")}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isFailed
                    ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-300"
                    : "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200"
                }`}
                title="Marcar como não realizado"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {!item.isAdHoc && onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(item);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-600" />
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    handleDeleteRoutine();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
