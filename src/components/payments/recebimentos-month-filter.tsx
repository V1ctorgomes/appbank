"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, parse } from "date-fns";

interface RecebimentosMonthFilterProps {
  defaultMonth: string;
  monthLabel: string;
}

export function RecebimentosMonthFilter({
  defaultMonth,
  monthLabel,
}: RecebimentosMonthFilterProps) {
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);

  function applyMonth(value: string) {
    setMonth(value);
    router.push(`/recebimentos?mes=${value}`);
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
    </div>
  );
}
