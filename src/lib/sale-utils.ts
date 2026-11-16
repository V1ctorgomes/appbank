import { addMonths } from "date-fns";
import { WEEKDAY_OPTIONS } from "@/lib/loan-utils";

export type InstallmentInput = {
  number: number;
  value: number;
  dueDate: string;
};

export type SaleInstallmentFrequency = "MONTHLY" | "WEEKLY";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseLocalDate(input: string): Date {
  const [y, m, d] = input.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function firstWeekdayOnOrAfter(start: Date, weekday: number): Date {
  const result = new Date(start);
  const delta = (weekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + delta);
  return result;
}

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function generateAutoInstallments(
  total: number,
  count: number,
  firstDueDate: string,
  opts?: {
    frequency?: SaleInstallmentFrequency;
    weekday?: number;
  }
): InstallmentInput[] {
  const frequency = opts?.frequency ?? "MONTHLY";
  const base = roundMoney(total / count);
  const installments: InstallmentInput[] = [];
  let sum = 0;
  const start = parseLocalDate(firstDueDate);

  if (frequency === "WEEKLY") {
    const weekday = opts?.weekday ?? start.getDay();
    let cursor = firstWeekdayOnOrAfter(start, weekday);
    for (let i = 0; i < count; i++) {
      const value = i === count - 1 ? roundMoney(total - sum) : base;
      sum = roundMoney(sum + value);
      installments.push({
        number: i + 1,
        value,
        dueDate: toDateInput(cursor),
      });
      cursor = addDays(cursor, 7);
    }
    return installments;
  }

  for (let i = 0; i < count; i++) {
    const value = i === count - 1 ? roundMoney(total - sum) : base;
    sum = roundMoney(sum + value);
    installments.push({
      number: i + 1,
      value,
      dueDate: addMonths(start, i).toISOString().slice(0, 10),
    });
  }

  return installments;
}

export function saleInstallmentFrequencyLabel(
  frequency: SaleInstallmentFrequency
): string {
  return frequency === "WEEKLY" ? "Semanal" : "Mensal";
}

export function saleInstallmentCountLabel(
  frequency: SaleInstallmentFrequency
): string {
  return frequency === "WEEKLY"
    ? "Quantidade de semanas *"
    : "Quantidade de parcelas *";
}

export { WEEKDAY_OPTIONS };

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

export function formatMoneyBr(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getInstallmentStatusForDate(dueDate: Date): "PENDING" | "OVERDUE" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today ? "OVERDUE" : "PENDING";
}

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
