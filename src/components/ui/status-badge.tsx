const styles: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-400",
  ACTIVE: "bg-blue-100 text-blue-700",
  SETTLED: "bg-green-100 text-green-700",
};

const labels: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  OVERDUE: "Atrasado",
  CANCELLED: "Cancelado",
  ACTIVE: "Ativo",
  SETTLED: "Quitado",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function SaleStatusBadge({
  pendingCount,
  paidCount,
  isFullyPaid,
}: {
  pendingCount: number;
  paidCount: number;
  isFullyPaid: boolean;
}) {
  if (isFullyPaid) {
    return <StatusBadge status="PAID" />;
  }
  if (pendingCount > 0 && paidCount > 0) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Parcial ({paidCount}/{paidCount + pendingCount})
      </span>
    );
  }
  return <StatusBadge status="PENDING" />;
}
