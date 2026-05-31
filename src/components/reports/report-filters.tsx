"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface ReportFiltersProps {
  defaultStart: string;
  defaultEnd: string;
}

export function ReportFilters({ defaultStart, defaultEnd }: ReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(
    searchParams.get("startDate") ?? defaultStart
  );
  const [endDate, setEndDate] = useState(searchParams.get("endDate") ?? defaultEnd);

  function applyFilters() {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    router.push(`/relatorios?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="De"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="Até"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button onClick={applyFilters}>
          <Search className="mr-1 h-4 w-4" />
          Filtrar
        </Button>
      </div>
    </div>
  );
}
