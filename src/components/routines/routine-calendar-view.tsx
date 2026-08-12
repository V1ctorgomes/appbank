"use client";

import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Target,
  Zap,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { formatDateForInput, formatDate } from "@/lib/utils";
import { RoutineIcon } from "./routine-icon";

interface RoutineCalendarViewProps {
  selectedDateStr: string;
  items: any[];
  onSelectDate: (dateStr: string) => void;
  onAddRoutineWithTime?: (startTime: string) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6; // 06:00 até 23:00
  return String(h).padStart(2, "0") + ":00";
});

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatDuration(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return null;
  const [h1, m1] = startTime.split(":").map(Number);
  const [h2, m2] = endTime.split(":").map(Number);
  const totalMins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (totalMins <= 0) return null;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getSpanHours(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return 1;
  const [h1, m1] = startTime.split(":").map(Number);
  const [h2, m2] = endTime.split(":").map(Number);
  const totalMins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (totalMins <= 0) return 1;
  return Math.max(1, Math.ceil(totalMins / 60));
}

export function RoutineCalendarView({
  selectedDateStr,
  items,
  onSelectDate,
  onAddRoutineWithTime,
}: RoutineCalendarViewProps) {
  const [viewMode, setViewMode] = useState<"TIMETABLE" | "MONTH">("TIMETABLE");

  // Data atual para navegação da semana/mês
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const [y, m] = selectedDateStr.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  // Dias da semana corrente baseados na selectedDateStr
  const getWeekDays = () => {
    const [y, m, d] = selectedDateStr.split("-").map(Number);
    const curr = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = curr.getUTCDay(); // 0 = Dom

    const sunday = new Date(curr);
    sunday.setUTCDate(curr.getUTCDate() - dayOfWeek);

    const days = [];
    const weekdaysShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (let i = 0; i < 7; i++) {
      const dObj = new Date(sunday);
      dObj.setUTCDate(sunday.getUTCDate() + i);
      const dStr = formatDateForInput(dObj);
      days.push({
        dateStr: dStr,
        dayNum: dObj.getUTCDate(),
        weekday: weekdaysShort[i],
        isToday: dStr === formatDateForInput(new Date()),
        isSelected: dStr === selectedDateStr,
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Dias do mês para a visualização mensal
  const getMonthDays = () => {
    const { year, month } = currentYearMonth;
    const firstDay = new Date(Date.UTC(year, month, 1, 12, 0, 0));
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
    const startingDayOfWeek = firstDay.getUTCDay();
    const totalDays = lastDay.getUTCDate();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      const dObj = new Date(Date.UTC(year, month, day, 12, 0, 0));
      const dStr = formatDateForInput(dObj);
      days.push({
        dateStr: dStr,
        dayNum: day,
        isToday: dStr === formatDateForInput(new Date()),
        isSelected: dStr === selectedDateStr,
      });
    }
    return days;
  };

  const monthDays = getMonthDays();

  const handlePrevMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  const unassignedItems = items.filter((item) => !item.startTime);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      {/* Header controls: Alternar Modo de Visão */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-base">Agenda & Bloco de Horários</h3>
        </div>

        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode("TIMETABLE")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
              viewMode === "TIMETABLE"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Agenda Semanal por Horários
          </button>
          <button
            type="button"
            onClick={() => setViewMode("MONTH")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
              viewMode === "MONTH"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Grade Mensal
          </button>
        </div>
      </div>

      {/* VISÃO 1: AGENDA SEMANAL POR HORÁRIOS */}
      {viewMode === "TIMETABLE" && (
        <div className="space-y-3">
          {/* Cabeçalho com os 7 dias da semana */}
          <div className="grid grid-cols-8 gap-1 text-center border-b border-slate-200 pb-2">
            <div className="text-[11px] font-bold text-slate-600 self-end pb-1">Horário</div>
            {weekDays.map((d) => (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => onSelectDate(d.dateStr)}
                className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-xs transition-all ${
                  d.isSelected
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : d.isToday
                    ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="text-[10px] uppercase opacity-80">{d.weekday}</span>
                <span className="text-xs font-bold">{d.dayNum}</span>
              </button>
            ))}
          </div>

          {/* Tarefas Sem Horário Fixo */}
          {unassignedItems.length > 0 && (
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 mb-2">
              <span className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                📌 Tarefas Sem Horário Específico ({unassignedItems.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {unassignedItems.map((item) => (
                  <span
                    key={item.id}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border ${
                      item.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 line-through"
                        : item.type === "BREAK_REST"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : item.isAdHoc
                        ? "bg-purple-100 text-purple-900 border-purple-300"
                        : "bg-blue-100 text-blue-900 border-blue-300"
                    }`}
                  >
                    <RoutineIcon name={item.icon} type={item.type} isAdHoc={item.isAdHoc} className="h-3.5 w-3.5" />
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Grade de Horários (Linhas de 06:00 a 23:00) */}
          <div className="max-h-[550px] overflow-y-auto space-y-1.5 pr-1">
            {HOURS.map((hourStr) => {
              const hourNum = parseInt(hourStr.split(":")[0], 10);

              return (
                <div key={hourStr} className="grid grid-cols-8 gap-1 min-h-[48px]">
                  {/* Coluna do Horário */}
                  <div className="flex items-center justify-center text-[11px] font-semibold text-slate-600 bg-slate-50 rounded-lg border border-slate-100">
                    {hourStr}
                  </div>

                  {/* 7 Colunas para os dias da semana */}
                  {weekDays.map((d) => {
                    const matchingItems = d.isSelected
                      ? items.filter((item) => {
                          if (!item.startTime) return false;
                          const itemHour = parseInt(item.startTime.split(":")[0], 10);
                          return itemHour === hourNum;
                        })
                      : [];

                    return (
                      <div
                        key={d.dateStr}
                        onClick={() => {
                          onSelectDate(d.dateStr);
                          if (onAddRoutineWithTime) onAddRoutineWithTime(hourStr);
                        }}
                        className={`group relative rounded-lg border p-1 transition-all cursor-pointer flex flex-col gap-1 min-h-[48px] ${
                          d.isSelected
                            ? "border-blue-200/80 bg-blue-50/20 hover:bg-blue-50/50"
                            : "border-slate-100 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {matchingItems.length > 0 ? (
                          matchingItems.map((item) => {
                            const isCompleted = item.status === "COMPLETED";
                            const isBreak = item.type === "BREAK_REST";
                            const isUnexpected = item.isAdHoc || item.status === "UNEXPECTED_EVENT";
                            const durationText = formatDuration(item.startTime, item.endTime);
                            const spanHours = getSpanHours(item.startTime, item.endTime);

                            const minHeightStyle = spanHours >= 3
                              ? "min-h-[158px] z-10 shadow-md"
                              : spanHours === 2
                              ? "min-h-[102px] z-10 shadow-sm"
                              : "min-h-[44px]";

                            return (
                              <div
                                key={item.id}
                                className={`w-full rounded-lg p-2 text-xs font-semibold border flex flex-col justify-between transition-all ${minHeightStyle} ${
                                  isCompleted
                                    ? "bg-emerald-100 text-emerald-900 border-emerald-300 line-through opacity-80"
                                    : isBreak
                                    ? "bg-amber-100 text-amber-950 border-amber-300 shadow-xs"
                                    : isUnexpected
                                    ? "bg-purple-100 text-purple-950 border-purple-300 shadow-xs"
                                    : "bg-blue-100 text-blue-950 border-blue-300 shadow-xs hover:border-blue-400"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <RoutineIcon
                                      name={item.icon}
                                      type={item.type}
                                      isAdHoc={item.isAdHoc}
                                      className="h-3.5 w-3.5 flex-shrink-0"
                                    />
                                    <span className="font-bold truncate text-xs leading-tight">{item.title}</span>
                                  </div>
                                  {durationText && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/10 flex-shrink-0">
                                      {durationText}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[10px] opacity-80 font-mono mt-1">
                                  <span>
                                    {item.startTime} {item.endTime ? `➔ ${item.endTime}` : ""}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full text-[10px] text-slate-400">
                            + {hourStr}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISÃO 2: GRADE MENSAL DE CALENDÁRIO */}
      {viewMode === "MONTH" && (
        <div className="space-y-3">
          {/* Seletor de Mês */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-sm font-bold text-slate-900">
              {monthNames[currentYearMonth.month]} {currentYearMonth.year}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Dias da Semana (Dom a Sáb) */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-600">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Grade de Dias do Mês */}
          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((d, idx) => {
              if (!d) {
                return <div key={`empty-${idx}`} className="h-16 rounded-lg bg-slate-50/50" />;
              }

              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => onSelectDate(d.dateStr)}
                  className={`flex flex-col justify-between p-2 h-20 rounded-xl border text-left transition-all ${
                    d.isSelected
                      ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/30 font-bold"
                      : d.isToday
                      ? "border-blue-300 bg-white ring-2 ring-blue-300/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-semibold rounded-full px-1.5 py-0.5 ${
                        d.isToday ? "bg-blue-600 text-white" : "text-slate-800"
                      }`}
                    >
                      {d.dayNum}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 truncate">
                    {d.isSelected && items.length > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        {items.length} rotinas
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
