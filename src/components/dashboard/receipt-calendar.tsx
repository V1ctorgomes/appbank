"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getDashboardCalendar,
  type DashboardCalendarDay,
} from "@/actions/dashboard";
import type { DashboardView } from "@/components/dashboard/dashboard-view-filter";
import { calendarDateKey, cn, formatCurrency, formatDate } from "@/lib/utils";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildMonthCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leading = first.getUTCDay();
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: ({ date: string; day: number } | null)[] = [];

  for (let index = 0; index < leading; index += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day });
  }
  return cells;
}

export function DashboardReceiptCalendar({
  view,
  initialMonth,
  initialDays,
}: {
  view: DashboardView;
  initialMonth: string;
  initialDays: DashboardCalendarDay[];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState(initialDays);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = calendarDateKey();
  const byDate = new Map(days.map((day) => [day.date, day]));
  const cells = buildMonthCells(month);
  const selectedDay = selected ? byDate.get(selected) : undefined;
  const monthDate = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR });

  function shiftMonth(delta: number) {
    const next = format(addMonths(monthDate, delta), "yyyy-MM");
    startTransition(async () => {
      try {
        const result = await getDashboardCalendar(view, next);
        setMonth(result.month);
        setDays(result.days);
        setSelected(null);
      } catch (err) {
        console.error("Erro ao carregar o calendário:", err);
      }
    });
  }

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Calendário de recebimentos
          </h2>
          <p className="text-sm capitalize text-slate-500">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-slate-200 bg-white" />
          Sem recebimento
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-blue-300 bg-blue-100" />
          A receber
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-emerald-300 bg-emerald-100" />
          Recebido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-red-300 bg-red-100" />
          Atrasado
        </span>
      </div>

      <div className={cn("space-y-1.5", pending && "opacity-60")}>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 sm:text-xs">
          {weekdays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="h-14 sm:h-16" />;
            }

            const info = byDate.get(cell.date);
            const status = info?.status ?? "empty";
            const isToday = cell.date === today;
            const isSelected = cell.date === selected;

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelected(cell.date)}
                className={cn(
                  "flex h-14 flex-col items-center justify-center rounded-lg border px-0.5 text-center transition-colors sm:h-16",
                  status === "empty" && "border-slate-200 bg-white text-slate-700",
                  status === "receive" && "border-blue-300 bg-blue-100 text-blue-950",
                  status === "received" &&
                    "border-emerald-300 bg-emerald-100 text-emerald-950",
                  status === "overdue" && "border-red-300 bg-red-100 text-red-950",
                  isToday && "ring-2 ring-primary-600",
                  isSelected && "outline outline-2 outline-offset-1 outline-slate-900"
                )}
              >
                <span className="text-xs font-semibold sm:text-sm">{cell.day}</span>
                {info && (
                  <span className="mt-0.5 max-w-full truncate text-[9px] font-medium leading-tight sm:text-[10px]">
                    {formatCurrency(info.total)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">
            {formatDate(selected)}
          </p>
          {!selectedDay || selectedDay.items.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum recebimento neste dia.</p>
          ) : (
            <ul className="space-y-2">
              {selectedDay.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{item.clientName}</p>
                    <p className="text-xs text-slate-500">
                      {item.label}
                      {item.status === "overdue"
                        ? " · Atrasado"
                        : item.status === "received"
                          ? " · Recebido"
                          : " · A receber"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-medium",
                      item.status === "overdue"
                        ? "text-red-700"
                        : item.status === "received"
                          ? "text-emerald-700"
                          : "text-blue-700"
                    )}
                  >
                    {formatCurrency(item.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
