import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className, title }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-6 shadow-sm", className)}>
      {title && <h3 className="mb-4 text-lg font-semibold text-slate-800">{title}</h3>}
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: "default" | "income" | "expense" | "warning";
}

export function StatCard({ title, value, subtitle, variant = "default" }: StatCardProps) {
  const variants = {
    default: "border-slate-200",
    income: "border-green-200 bg-green-50/50",
    expense: "border-red-200 bg-red-50/50",
    warning: "border-amber-200 bg-amber-50/50",
  };

  const valueColors = {
    default: "text-slate-900",
    income: "text-green-700",
    expense: "text-red-700",
    warning: "text-amber-700",
  };

  return (
    <div className={cn("rounded-xl border p-5 shadow-sm", variants[variant])}>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className={cn("mt-1 text-2xl font-bold", valueColors[variant])}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
