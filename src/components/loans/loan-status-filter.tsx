"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LoanListStatus } from "@/actions/loans";

const options: { value: LoanListStatus; label: string }[] = [
  { value: "ativos", label: "Ativos" },
  { value: "quitados", label: "Quitados" },
  { value: "todos", label: "Todos" },
];

export function LoanStatusFilter({
  current,
  search,
}: {
  current: LoanListStatus;
  search?: string;
}) {
  const router = useRouter();

  function select(status: LoanListStatus) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "ativos") params.set("status", status);
    const query = params.toString();
    router.push(query ? `/emprestimos?${query}` : "/emprestimos");
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
