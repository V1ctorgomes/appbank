import { roundMoney } from "@/lib/sale-utils";

export type LoanPaymentAllocationType =
  | "INTEREST_ONLY"
  | "INTEREST_AND_PARTIAL"
  | "FULL_SETTLEMENT";

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

export function calcMonthlyInterest(balance: number, interestRate: number): number {
  return roundMoney((balance * interestRate) / 100);
}

/**
 * Aloca o valor pago automaticamente:
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

export function loanPaymentTypeLabel(type: string): string {
  switch (type) {
    case "INTEREST_ONLY":
      return "Só juros";
    case "INTEREST_AND_PARTIAL":
      return "Juros + amortização";
    case "FULL_SETTLEMENT":
      return "Quitação";
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

export function formatPaymentSchedule(paymentDay: number, billingStartMonth: Date | string): string {
  return `A partir de ${formatBillingMonth(billingStartMonth)}, todo dia ${paymentDay}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dueDateInMonth(year: number, monthIndex: number, paymentDay: number): Date {
  const day = Math.min(paymentDay, daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, day, 12, 0, 0);
}

/**
 * Vencimento do empréstimo em um mês específico, ou null se a cobrança ainda não começou.
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
 * Próximo vencimento: dia do pagamento a cada mês, a partir do mês de início da cobrança.
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

