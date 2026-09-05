import { roundMoney } from "@/lib/sale-utils";

export type LoanPaymentFrequency = "MONTHLY" | "WEEKLY" | "DAILY" | "BIWEEKLY";

export type LoanPaymentAllocationType =
  | "INTEREST_ONLY"
  | "INTEREST_AND_PARTIAL"
  | "FULL_SETTLEMENT"
  | "INSTALLMENT";

export type LoanPaymentAllocation = {
  type: LoanPaymentAllocationType;
  interestValue: number;
  principalValue: number;
  totalValue: number;
  balanceBefore: number;
  balanceAfter: number;
  interestDue: number;
  settleTotal: number;
};

export const LOAN_INSTALLMENT_COUNTS: Record<
  Exclude<LoanPaymentFrequency, "MONTHLY">,
  number
> = {
  DAILY: 30,
  WEEKLY: 4,
  BIWEEKLY: 2,
};

export const WEEKDAY_OPTIONS = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
] as const;

export function isInstallmentFrequency(
  frequency: string | null | undefined
): frequency is "WEEKLY" | "DAILY" | "BIWEEKLY" {
  return frequency === "WEEKLY" || frequency === "DAILY" || frequency === "BIWEEKLY";
}

export function calcMonthlyInterest(balance: number, interestRate: number): number {
  return roundMoney((balance * interestRate) / 100);
}

export function calcLoanTotalDue(principal: number, interestRate: number): number {
  return roundMoney(principal + calcMonthlyInterest(principal, interestRate));
}

/**
 * Aloca o valor pago automaticamente (empréstimos mensais):
 * - exatamente o juros (ou até o juros) → só juros
 * - juros + parte do saldo → amortização parcial e novo saldo
 * - juros + saldo (ou mais) → quitação
 */
export function allocateLoanPayment(
  remainingBalance: number,
  interestRate: number,
  paidAmount: number
): LoanPaymentAllocation | { error: string } {
  const balance = roundMoney(remainingBalance);
  const paid = roundMoney(paidAmount);

  if (balance <= 0) {
    return { error: "Empréstimo já está quitado" };
  }
  if (paid <= 0) {
    return { error: "Valor pago deve ser maior que zero" };
  }

  const interestDue = calcMonthlyInterest(balance, interestRate);
  const settleTotal = roundMoney(balance + interestDue);

  if (paid >= settleTotal - 0.009) {
    return {
      type: "FULL_SETTLEMENT",
      interestValue: interestDue,
      principalValue: balance,
      totalValue: settleTotal,
      balanceBefore: balance,
      balanceAfter: 0,
      interestDue,
      settleTotal,
    };
  }

  if (paid <= interestDue + 0.009) {
    return {
      type: "INTEREST_ONLY",
      interestValue: paid,
      principalValue: 0,
      totalValue: paid,
      balanceBefore: balance,
      balanceAfter: balance,
      interestDue,
      settleTotal,
    };
  }

  const principalValue = roundMoney(paid - interestDue);
  const balanceAfter = roundMoney(balance - principalValue);

  return {
    type: "INTEREST_AND_PARTIAL",
    interestValue: interestDue,
    principalValue,
    totalValue: paid,
    balanceBefore: balance,
    balanceAfter: balanceAfter < 0 ? 0 : balanceAfter,
    interestDue,
    settleTotal,
  };
}

/** Quitação de empréstimo parcelado: juros já embutidos no totalDue. */
export function allocateInstallmentSettlement(
  remainingBalance: number
): LoanPaymentAllocation | { error: string } {
  const balance = roundMoney(remainingBalance);
  if (balance <= 0) {
    return { error: "Empréstimo já está quitado" };
  }
  return {
    type: "FULL_SETTLEMENT",
    interestValue: 0,
    principalValue: balance,
    totalValue: balance,
    balanceBefore: balance,
    balanceAfter: 0,
    interestDue: 0,
    settleTotal: balance,
  };
}

export function loanPaymentTypeLabel(type: string): string {
  switch (type) {
    case "INTEREST_ONLY":
      return "Só juros";
    case "INTEREST_AND_PARTIAL":
      return "Juros + amortização";
    case "FULL_SETTLEMENT":
      return "Quitação";
    case "INSTALLMENT":
      return "Parcela";
    default:
      return type;
  }
}

export function loanStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Ativo";
    case "SETTLED":
      return "Quitado";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}

export function loanFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case "MONTHLY":
      return "Mensal";
    case "WEEKLY":
      return "Semanal";
    case "DAILY":
      return "Diária";
    case "BIWEEKLY":
      return "Quinzenal";
    default:
      return frequency;
  }
}

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_OPTIONS.find((o) => o.value === String(weekday))?.label ?? `Dia ${weekday}`;
}

export function monthInputFromDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Converte `yyyy-MM` para Date no dia 1 (meio-dia UTC local via T12). */
export function monthInputToDate(month: string): Date {
  return new Date(`${month}-01T12:00:00`);
}

export function formatBillingMonth(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatPaymentSchedule(
  paymentDay: number,
  billingStartMonth: Date | string,
  opts?: {
    paymentFrequency?: string | null;
    weekday?: number | null;
    paymentDay2?: number | null;
    billingStartDate?: Date | string | null;
  }
): string {
  const frequency = opts?.paymentFrequency ?? "MONTHLY";

  if (frequency === "DAILY") {
    const start = opts?.billingStartDate ?? billingStartMonth;
    const startLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(typeof start === "string" ? new Date(start) : start);
    return `Diária a partir de ${startLabel}`;
  }

  if (frequency === "WEEKLY") {
    const day = opts?.weekday != null ? weekdayLabel(opts.weekday) : "dia escolhido";
    const start = opts?.billingStartDate ?? billingStartMonth;
    const startLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(typeof start === "string" ? new Date(start) : start);
    return `${day}, a partir de ${startLabel}`;
  }

  if (frequency === "BIWEEKLY") {
    const d1 = paymentDay;
    const d2 = opts?.paymentDay2 ?? paymentDay;
    const start = opts?.billingStartDate ?? billingStartMonth;
    const startLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(typeof start === "string" ? new Date(start) : start);
    return `Dias ${d1} e ${d2}, a partir de ${startLabel}`;
  }

  return `A partir de ${formatBillingMonth(billingStartMonth)}, todo dia ${paymentDay}`;
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

export type GeneratedLoanInstallment = {
  number: number;
  value: number;
  dueDate: string;
};

function splitInstallmentValues(total: number, count: number): number[] {
  const base = roundMoney(total / count);
  const values: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const value = i === count - 1 ? roundMoney(total - sum) : base;
    values.push(value);
    sum = roundMoney(sum + value);
  }
  return values;
}

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function generateLoanInstallments(input: {
  frequency: "WEEKLY" | "DAILY" | "BIWEEKLY";
  totalDue: number;
  billingStartDate: string;
  weekday?: number;
  paymentDay?: number;
  paymentDay2?: number;
}): GeneratedLoanInstallment[] {
  const count = LOAN_INSTALLMENT_COUNTS[input.frequency];
  const values = splitInstallmentValues(input.totalDue, count);
  const start = parseLocalDate(input.billingStartDate);
  const dueDates: Date[] = [];

  if (input.frequency === "DAILY") {
    for (let i = 0; i < count; i++) {
      dueDates.push(addDays(start, i));
    }
  } else if (input.frequency === "WEEKLY") {
    const weekday = input.weekday ?? 1;
    let cursor = firstWeekdayOnOrAfter(start, weekday);
    for (let i = 0; i < count; i++) {
      dueDates.push(new Date(cursor));
      cursor = addDays(cursor, 7);
    }
  } else {
    const d1 = input.paymentDay ?? 1;
    const d2 = input.paymentDay2 ?? 16;
    const days = [d1, d2].sort((a, b) => a - b);
    let year = start.getFullYear();
    let month = start.getMonth();
    let safety = 0;

    while (dueDates.length < count && safety < 36) {
      for (const day of days) {
        const due = dueDateInMonth(year, month, day);
        if (due >= start) {
          dueDates.push(due);
          if (dueDates.length >= count) break;
        }
      }
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      safety += 1;
    }
  }

  return values.map((value, index) => ({
    number: index + 1,
    value,
    dueDate: toDateInput(dueDates[index] ?? start),
  }));
}

/**
 * Vencimento do empréstimo mensal em um mês específico, ou null se a cobrança ainda não começou.
 */
export function loanDueDateForMonth(
  paymentDay: number,
  billingStartMonth: Date | string,
  year: number,
  monthIndex: number
): Date | null {
  const start = typeof billingStartMonth === "string"
    ? new Date(billingStartMonth)
    : billingStartMonth;

  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();

  if (year < startYear || (year === startYear && monthIndex < startMonth)) {
    return null;
  }

  return dueDateInMonth(year, monthIndex, paymentDay);
}

/**
 * Próximo vencimento mensal: dia do pagamento a cada mês, a partir do mês de início da cobrança.
 */
export function nextLoanDueDate(
  paymentDay: number,
  billingStartMonth: Date | string,
  from = new Date()
): Date {
  const start = typeof billingStartMonth === "string"
    ? new Date(billingStartMonth)
    : billingStartMonth;

  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const firstDue = dueDateInMonth(startYear, startMonth, paymentDay);

  const today = new Date(from);
  today.setHours(12, 0, 0, 0);

  if (today <= firstDue) {
    return firstDue;
  }

  const year = today.getFullYear();
  const month = today.getMonth();
  const candidate = dueDateInMonth(year, month, paymentDay);

  if (today.getDate() <= candidate.getDate()) {
    return candidate.getTime() < firstDue.getTime() ? firstDue : candidate;
  }

  const nextMonth = month + 1;
  const y = nextMonth > 11 ? year + 1 : year;
  const m = nextMonth % 12;
  const next = dueDateInMonth(y, m, paymentDay);
  return next.getTime() < firstDue.getTime() ? firstDue : next;
}

export function settleTotalForLoan(input: {
  paymentFrequency: string;
  remainingBalance: number;
  interestRate: number;
}): number {
  if (isInstallmentFrequency(input.paymentFrequency)) {
    return roundMoney(input.remainingBalance);
  }
  return roundMoney(
    input.remainingBalance + calcMonthlyInterest(input.remainingBalance, input.interestRate)
  );
}
