"use client";

import {
  DEFAULT_DAILY_WEEKDAYS,
  WEEKDAY_CHECKBOX_OPTIONS,
} from "@/lib/loan-utils";
import { cn } from "@/lib/utils";

type WeekdayMultiSelectProps = {
  value: number[];
  onChange: (days: number[]) => void;
  label?: string;
};

export function WeekdayMultiSelect({
  value,
  onChange,
  label = "Dias de cobrança *",
}: WeekdayMultiSelectProps) {
  const selected = new Set(value);

  function toggle(day: number) {
    const next = selected.has(day)
      ? value.filter((d) => d !== day)
      : [...value, day].sort((a, b) => {
          const order = (d: number) => (d === 0 ? 7 : d);
          return order(a) - order(b);
        });
    onChange(next);
  }

  function applyPreset(days: number[]) {
    onChange([...days]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="text-primary-600 hover:underline"
            onClick={() => applyPreset(DEFAULT_DAILY_WEEKDAYS)}
          >
            Seg–Sáb
          </button>
          <button
            type="button"
            className="text-primary-600 hover:underline"
            onClick={() => applyPreset([1, 2, 3, 4, 5])}
          >
            Seg–Sex
          </button>
          <button
            type="button"
            className="text-primary-600 hover:underline"
            onClick={() => applyPreset([0, 1, 2, 3, 4, 5, 6])}
          >
            Todos
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_CHECKBOX_OPTIONS.map((opt) => {
          const active = selected.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              aria-pressed={active}
              title={opt.label}
              className={cn(
                "min-w-[2.75rem] rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              )}
            >
              {opt.short}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        As parcelas só caem nos dias marcados (ex.: tire o domingo).
      </p>
    </div>
  );
}
