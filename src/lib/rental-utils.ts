import { roundMoney } from "@/lib/sale-utils";
import {
  DEFAULT_DAILY_WEEKDAYS,
  formatActiveWeekdays,
  normalizeActiveWeekdays,
  WEEKDAY_OPTIONS,
  weekdayLabel,
} from "@/lib/loan-utils";

export type RentalPaymentFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type RentalListStatus = "ativos" | "finalizados" | "todos";

export const MAX_RENTAL_INSTALLMENTS = 365;

export const DEFAULT_RENTAL_INSTALLMENT_COUNTS: Record<
  RentalPaymentFrequency,
  number
> = {
  DAILY: 30,
  WEEKLY: 60,
  BIWEEKLY: 24,
  MONTHLY: 12,
};

export function parseRentalListStatus(value?: string): RentalListStatus {
  if (value === "finalizados" || value === "todos") return value;
  return "ativos";
}

export function rentalFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case "DAILY":
      return "Diária";
    case "WEEKLY":
      return "Semanal";
    case "BIWEEKLY":
      return "Quinzenal";
    case "MONTHLY":
      return "Mensal";
    default:
      return frequency;
  }
}

export function rentalStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Ativo";
    case "TRANSFERRED":
      return "Transferido";
    case "RETURNED":
      return "Devolvido";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}

export function rentalCountLabel(frequency: RentalPaymentFrequency): string {
  switch (frequency) {
    case "DAILY":
      return "Quantidade de dias";
    case "WEEKLY":
      return "Quantidade de semanas";
    case "BIWEEKLY":
      return "Quantidade de quinzenas";
    case "MONTHLY":
      return "Quantidade de meses";
  }
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dueDateInMonth(year: number, monthIndex: number, paymentDay: number): Date {
  const day = Math.min(paymentDay, daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, day, 12, 0, 0);
}

function parseLocalDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12, 0, 0);
  }
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

export type GeneratedRentalInstallment = {
  number: number;
  value: number;
  dueDate: string;
};

export function generateRentalInstallments(input: {
  frequency: RentalPaymentFrequency;
  installmentValue: number;
  installmentCount: number;
  startDate: string;
  weekday?: number;
  paymentDay?: number;
  paymentDay2?: number;
  activeWeekdays?: number[];
}): GeneratedRentalInstallment[] {
  const count = Math.max(1, Math.min(input.installmentCount, MAX_RENTAL_INSTALLMENTS));
  const value = roundMoney(input.installmentValue);
  const start = parseLocalDate(input.startDate);
  const dueDates: Date[] = [];

  if (input.frequency === "DAILY") {
    const weekdays = new Set(
      normalizeActiveWeekdays(input.activeWeekdays?.length ? input.activeWeekdays : DEFAULT_DAILY_WEEKDAYS)
    );
    let cursor = new Date(start);
    let safety = 0;
    while (dueDates.length < count && safety < count * 14) {
      if (weekdays.has(cursor.getDay())) {
        dueDates.push(new Date(cursor));
      }
      cursor = addDays(cursor, 1);
      safety += 1;
    }
  } else if (input.frequency === "WEEKLY") {
    const weekday = input.weekday ?? 1;
    let cursor = firstWeekdayOnOrAfter(start, weekday);
    for (let i = 0; i < count; i++) {
      dueDates.push(new Date(cursor));
      cursor = addDays(cursor, 7);
    }
  } else if (input.frequency === "BIWEEKLY") {
    // Quinzena = a cada 14 dias no dia da semana escolhido (mesmo padrão da semanal).
    const weekday = input.weekday ?? 1;
    let cursor = firstWeekdayOnOrAfter(start, weekday);
    for (let i = 0; i < count; i++) {
      dueDates.push(new Date(cursor));
      cursor = addDays(cursor, 14);
    }
  } else {
    const paymentDay = input.paymentDay ?? start.getDate();
    let cursor = dueDateInMonth(start.getFullYear(), start.getMonth(), paymentDay);
    if (cursor < start) {
      let y = start.getFullYear();
      let m = start.getMonth() + 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      cursor = dueDateInMonth(y, m, paymentDay);
    }
    for (let i = 0; i < count; i++) {
      dueDates.push(new Date(cursor));
      let y = cursor.getFullYear();
      let m = cursor.getMonth() + 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      cursor = dueDateInMonth(y, m, paymentDay);
    }
  }

  return dueDates.slice(0, count).map((due, index) => ({
    number: index + 1,
    value,
    dueDate: toDateInput(due),
  }));
}

export function formatRentalSchedule(input: {
  paymentFrequency: string;
  startDate: Date | string;
  weekday?: number | null;
  paymentDay?: number | null;
  paymentDay2?: number | null;
  activeWeekdays?: number[] | null;
  installmentCount: number;
  installmentValue: number;
}): string {
  const start =
    typeof input.startDate === "string"
      ? input.startDate.slice(0, 10)
      : toDateInput(
          new Date(
            input.startDate.getFullYear(),
            input.startDate.getMonth(),
            input.startDate.getDate()
          )
        );
  const startLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(start + "T12:00:00"));

  const count = input.installmentCount;
  const freq = rentalFrequencyLabel(input.paymentFrequency);

  if (input.paymentFrequency === "WEEKLY") {
    const day =
      input.weekday != null ? weekdayLabel(input.weekday) : "dia escolhido";
    return `${count}× semanal (${day}) a partir de ${startLabel}`;
  }
  if (input.paymentFrequency === "DAILY") {
    return `${count}× diária (${formatActiveWeekdays(input.activeWeekdays)}) a partir de ${startLabel}`;
  }
  if (input.paymentFrequency === "BIWEEKLY") {
    const day =
      input.weekday != null ? weekdayLabel(input.weekday) : "dia escolhido";
    return `${count}× quinzenal (${day}, a cada 14 dias) a partir de ${startLabel}`;
  }
  return `${count}× mensal (dia ${input.paymentDay ?? "—"}) a partir de ${startLabel} · ${freq}`;
}

export { WEEKDAY_OPTIONS, DEFAULT_DAILY_WEEKDAYS };
