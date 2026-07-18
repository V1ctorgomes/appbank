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
