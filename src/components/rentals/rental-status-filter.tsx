"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RentalListStatus } from "@/lib/rental-utils";

const options: { value: RentalListStatus; label: string }[] = [
  { value: "ativos", label: "Ativos" },
  { value: "finalizados", label: "Finalizados" },
  { value: "todos", label: "Todos" },
];

export function RentalStatusFilter({
  current,
  search,
}: {
  current: RentalListStatus;
  search?: string;
}) {
  const router = useRouter();

  function select(status: RentalListStatus) {
    const params = new URLSearchParams();
    if (status !== "ativos") params.set("status", status);
    if (search) params.set("search", search);
    const qs = params.toString();
    router.push(qs ? `/alugueis?${qs}` : "/alugueis");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            current === opt.value
              ? "bg-primary-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
