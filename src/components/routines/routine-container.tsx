"use client";

import { useState, useEffect } from "react";
import { formatDate, formatDateForInput } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Zap,
  CheckCircle2,
  ListTodo,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRoutinesForDate } from "@/actions/routines";
import { RoutineCard } from "./routine-card";
import { RoutineFormModal } from "./routine-form-modal";
import { AdHocLogModal } from "./adhoc-log-modal";
import { RoutineWeeklyBar } from "./routine-weekly-bar";
import { RoutineCalendarView } from "./routine-calendar-view";

interface RoutineContainerProps {
  initialData: {
    dateStr: string;
    items: any[];
    summary: {
      total: number;
      completed: number;
      percentage: number;
    };
  };
}

export function RoutineContainer({ initialData }: RoutineContainerProps) {
  const [selectedDateStr, setSelectedDateStr] = useState(initialData.dateStr);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [mainView, setMainView] = useState<"AGENDA" | "TIMELINE">("AGENDA");

  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [routineToEdit, setRoutineToEdit] = useState<any | null>(null);
  const [initialStartTime, setInitialStartTime] = useState<string | undefined>(undefined);

  // Recarrega os dados do dia quando selectedDateStr é alterado
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getRoutinesForDate(selectedDateStr).then((res) => {
      if (isMounted && res) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedDateStr]);

  const handleRefresh = () => {
    getRoutinesForDate(selectedDateStr).then((res) => {
      if (res) setData(res);
    });
  };

  const todayStr = formatDateForInput(new Date());
  const isToday = selectedDateStr === todayStr;

  const handleNavigateDays = (offset: number) => {
    const [y, m, d] = selectedDateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    dateObj.setUTCDate(dateObj.getUTCDate() + offset);
    setSelectedDateStr(formatDateForInput(dateObj));
  };

  const formattedSelectedDate = () => {
    const [y, m, d] = selectedDateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return formatDate(dateObj);
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {isToday ? "Rotina & Agenda de Hoje" : `Agenda de ${formattedSelectedDate()}`}
              </h2>
              {isToday && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                  HOJE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Acompanhe horários, descansos e registe imprevistos em formato de agenda
            </p>
          </div>
        </div>

        {/* Controls: Date Prev/Next & View Toggles & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main View Mode Selector (Agenda vs Timeline List) */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 mr-2">
            <button
              type="button"
              onClick={() => setMainView("AGENDA")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mainView === "AGENDA"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Visão de Agenda
            </button>
            <button
              type="button"
              onClick={() => setMainView("TIMELINE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mainView === "TIMELINE"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Visão em Lista
            </button>
          </div>

          {/* Day Navigator */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => handleNavigateDays(-1)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
              title="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDateStr(todayStr)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleNavigateDays(1)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
              title="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            onClick={() => setShowAdHocModal(true)}
            variant="secondary"
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <Zap className="h-4 w-4 mr-1.5" />
            Imprevisto
          </Button>

          <Button
            onClick={() => {
              setRoutineToEdit(null);
              setInitialStartTime(undefined);
              setShowRoutineModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Rotina
          </Button>
        </div>
      </div>

      {/* Progress Summary Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
          <span className="flex items-center gap-1.5 font-semibold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Progresso do Dia: {data.summary.completed} de {data.summary.total} tarefas
          </span>
          <span className="font-bold text-slate-900">{data.summary.percentage}%</span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              data.summary.percentage >= 100
                ? "bg-emerald-500"
                : data.summary.percentage >= 60
                ? "bg-blue-600"
                : "bg-amber-500"
            }`}
            style={{ width: `${data.summary.percentage}%` }}
          />
        </div>
      </div>

      {/* Weekly Consistência Bar */}
      <RoutineWeeklyBar
        selectedDateStr={selectedDateStr}
        onSelectDate={(date) => setSelectedDateStr(date)}
      />

      {/* VISÃO PRINCIPAL: AGENDA OU LISTA */}
      {mainView === "AGENDA" ? (
        <RoutineCalendarView
          selectedDateStr={selectedDateStr}
          items={data.items}
          onSelectDate={(dateStr) => setSelectedDateStr(dateStr)}
          onAddRoutineWithTime={(timeStr) => {
            setRoutineToEdit(null);
            setInitialStartTime(timeStr);
            setShowRoutineModal(true);
          }}
        />
      ) : (
        /* VISÃO LISTA / TIMELINE */
        <div className="space-y-3">
          {data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-12 px-4 text-center">
              <div className="rounded-full bg-blue-50 p-4 text-blue-600 mb-3">
                <ListTodo className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Nenhuma atividade agendada</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mb-6">
                Você não tem rotinas cadastradas para este dia da semana. Cadastre suas rotinas recorrentes
                ou registre um imprevisto pontual.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() => {
                    setRoutineToEdit(null);
                    setInitialStartTime(undefined);
                    setShowRoutineModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Cadastrar Primeira Rotina
                </Button>
              </div>
            </div>
          ) : (
            data.items.map((item) => (
              <RoutineCard
                key={item.id}
                item={item}
                dateStr={selectedDateStr}
                onEdit={(routine) => {
                  setRoutineToEdit(routine);
                  setInitialStartTime(undefined);
                  setShowRoutineModal(true);
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Modais */}
      {showRoutineModal && (
        <RoutineFormModal
          routineToEdit={routineToEdit}
          initialStartTime={initialStartTime}
          onClose={() => {
            setShowRoutineModal(false);
            setRoutineToEdit(null);
            setInitialStartTime(undefined);
          }}
        />
      )}

      {showAdHocModal && (
        <AdHocLogModal
          dateStr={selectedDateStr}
          onClose={() => setShowAdHocModal(false)}
        />
      )}
    </div>
  );
}
