import { addMonths } from "date-fns";

export type InstallmentInput = {
  number: number;
  value: number;
  dueDate: string;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function generateAutoInstallments(
  total: number,
  count: number,
  firstDueDate: string
): InstallmentInput[] {
  const base = roundMoney(total / count);
  const installments: InstallmentInput[] = [];
  let sum = 0;
  const start = new Date(firstDueDate + "T12:00:00");

  for (let i = 0; i < count; i++) {
    const value = i === count - 1 ? roundMoney(total - sum) : base;
    sum += value;
    installments.push({
      number: i + 1,
      value,
      dueDate: addMonths(start, i).toISOString().slice(0, 10),
    });
  }

  return installments;
}

export function validateInstallmentSum(
  installments: { value: number }[],
  total: number
): boolean {
  const sum = roundMoney(installments.reduce((acc, i) => acc + i.value, 0));
  return Math.abs(sum - roundMoney(total)) < 0.01;
}

export function calcItemTotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export function calcSaleTotalFromItems(
  items: { quantity: number; unitPrice: number }[]
): number {
  return roundMoney(items.reduce((acc, i) => acc + calcItemTotal(i.quantity, i.unitPrice), 0));
}

type InstallmentLike = { status: string; value: unknown };

export function getSalePaymentSummary(installments: InstallmentLike[]) {
  const pending = installments.filter(
    (i) => i.status === "PENDING" || i.status === "OVERDUE"
  );
  const paid = installments.filter((i) => i.status === "PAID");

  return {
    pendingCount: pending.length,
    paidCount: paid.length,
    pendingValue: pending.reduce((s, i) => s + Number(i.value), 0),
    isFullyPaid: pending.length === 0 && paid.length > 0,
  };
}
