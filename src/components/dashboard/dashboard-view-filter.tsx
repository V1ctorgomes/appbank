"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type DashboardView = "geral" | "emprestimos";

const options: { value: DashboardView; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "emprestimos", label: "Empréstimos" },
];

export function DashboardViewFilter({ current }: { current: DashboardView }) {
  const router = useRouter();

  function select(view: DashboardView) {
    if (view === "geral") {
      router.push("/dashboard");
      return;
    }
    router.push(`/dashboard?visao=${view}`);
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
