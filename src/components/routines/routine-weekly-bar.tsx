"use client";

import { useEffect, useState } from "react";
import { getRoutineWeeklySummary } from "@/actions/routines";

interface RoutineWeeklyBarProps {
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
}

export function RoutineWeeklyBar({ selectedDateStr, onSelectDate }: RoutineWeeklyBarProps) {
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        const data = await getRoutineWeeklySummary();
        setDays(data);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, [selectedDateStr]);

  if (loading) {
    return (
      <div className="h-16 w-full animate-pulse rounded-xl bg-slate-100/80" />
    );
  }

  if (days.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
        <span>Consistência Semanal</span>
        <span className="text-slate-500 font-normal">Últimos 7 dias</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isSelected = d.dateStr === selectedDateStr;
          const isFull = d.percentage >= 100;
          const isGood = d.percentage >= 70;
          const isLow = d.percentage > 0 && d.percentage < 70;

          return (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => onSelectDate(d.dateStr)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs transition-all ${
                isSelected
                  ? "ring-2 ring-blue-600 bg-blue-50/50 font-bold"
                  : "hover:bg-slate-50 border border-slate-100"
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase">{d.weekday}</span>
              <span className="font-semibold text-slate-900">{d.dayNum}</span>

              {/* Status Badge */}
              <div className="mt-1 flex items-center gap-1">
                {d.total === 0 ? (
                  <span className="h-2 w-2 rounded-full bg-slate-200" title="Sem tarefas" />
                ) : isFull ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-500" title="100% Concluído" />
                ) : isGood ? (
                  <span className="h-2 w-2 rounded-full bg-blue-500" title={`${d.percentage}% Concluído`} />
                ) : isLow ? (
                  <span className="h-2 w-2 rounded-full bg-amber-500" title={`${d.percentage}% Concluído`} />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-rose-400" title="0% Concluído" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
