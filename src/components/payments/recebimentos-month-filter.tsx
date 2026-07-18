"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, parse } from "date-fns";
import { cn } from "@/lib/utils";
import type { RecebimentoTipo } from "@/lib/recebimentos";

interface RecebimentosMonthFilterProps {
  defaultMonth: string;
  monthLabel: string;
  defaultTipo: RecebimentoTipo;
}

const tipoOptions: { value: RecebimentoTipo; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vendas", label: "Vendas" },
  { value: "emprestimos", label: "Empréstimos" },
];

export function RecebimentosMonthFilter({
  defaultMonth,
  monthLabel,
  defaultTipo,
}: RecebimentosMonthFilterProps) {
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);
  const [tipo, setTipo] = useState<RecebimentoTipo>(defaultTipo);

  function navigate(nextMonth: string, nextTipo: RecebimentoTipo) {
    const params = new URLSearchParams();
    params.set("mes", nextMonth);
    if (nextTipo !== "todos") params.set("tipo", nextTipo);
    router.push(`/recebimentos?${params.toString()}`);
  }

  function applyMonth(value: string) {
    setMonth(value);
    navigate(value, tipo);
  }

  function applyTipo(value: RecebimentoTipo) {
    setTipo(value);
    navigate(month, value);
  }

  function shiftMonth(delta: number) {
    const date = parse(`${month}-01`, "yyyy-MM-dd", new Date());
    const next = format(addMonths(date, delta), "yyyy-MM");
    applyMonth(next);
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Período</p>
          <p className="text-lg font-semibold capitalize text-slate-900">{monthLabel}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            label="Mês"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" onClick={() => applyMonth(month)}>
            <Search className="mr-1 h-4 w-4" />
            Filtrar
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tipoOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => applyTipo(opt.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tipo === opt.value
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
