"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  getAllTransactions,
  getTransactionSummary,
  type TransactionFilters,
} from "@/actions/transactions";
import { isInstallmentFrequency, nextLoanDueDate } from "@/lib/loan-utils";

export type AccountsReceivableItem = {
  clientId: string;
  clientName: string;
  pendingValue: number;
  salesPending: number;
  loansPending: number;
  pendingCount: number;
  nextDue: Date | null;
};

export async function getAccountsReceivable(): Promise<AccountsReceivableItem[]> {
  const user = await requireAuth();

  const clients = await prisma.client.findMany({
    where: { userId: user.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      sales: {
        where: { deletedAt: null },
        select: {
          installments: {
            where: {
              deletedAt: null,
              status: { in: ["PENDING", "OVERDUE"] },
            },
            orderBy: { dueDate: "asc" },
            select: { value: true, dueDate: true },
          },
        },
      },
      loans: {
        where: { deletedAt: null, status: "ACTIVE" },
        select: {
          remainingBalance: true,
          interestRate: true,
          paymentFrequency: true,
          paymentDay: true,
          billingStartMonth: true,
          installments: {
            where: {
              deletedAt: null,
              status: { in: ["PENDING", "OVERDUE"] },
            },
            orderBy: { dueDate: "asc" },
            select: { dueDate: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return clients
    .map((client) => {
      const pendingInstallments = client.sales.flatMap((s) => s.installments);
      const salesPending = pendingInstallments.reduce(
        (sum, i) => sum + Number(i.value),
        0
      );
      const loansPending = client.loans.reduce(
        (sum, loan) => sum + Number(loan.remainingBalance),
        0
      );
      const pendingValue = salesPending + loansPending;
      if (pendingValue <= 0) return null;

      const dueDates: Date[] = pendingInstallments.map((i) => i.dueDate);
      for (const loan of client.loans) {
        if (isInstallmentFrequency(loan.paymentFrequency)) {
          for (const inst of loan.installments) dueDates.push(inst.dueDate);
        } else if (Number(loan.remainingBalance) > 0) {
          dueDates.push(
            nextLoanDueDate(loan.paymentDay, loan.billingStartMonth)
          );
        }
      }
      dueDates.sort((a, b) => a.getTime() - b.getTime());

      return {
        clientId: client.id,
        clientName: client.name,
        pendingValue,
        salesPending,
        loansPending,
        pendingCount: pendingInstallments.length + client.loans.length,
        nextDue: dueDates[0] ?? null,
      };
    })
    .filter((item): item is AccountsReceivableItem => item !== null)
    .sort((a, b) => b.pendingValue - a.pendingValue);
}

export async function getReportData(filters: TransactionFilters = {}) {
  await requireAuth();

  const [summary, transactions, accountsReceivable] = await Promise.all([
    getTransactionSummary(filters),
    getAllTransactions(filters),
    getAccountsReceivable(),
  ]);

  const totalReceivable = accountsReceivable.reduce(
    (sum, a) => sum + a.pendingValue,
    0
  );
  const totalSalesReceivable = accountsReceivable.reduce(
    (sum, a) => sum + a.salesPending,
    0
  );
  const totalLoansReceivable = accountsReceivable.reduce(
    (sum, a) => sum + a.loansPending,
    0
  );

  return {
    summary,
    transactions,
    accountsReceivable,
    totalReceivable,
    totalSalesReceivable,
    totalLoansReceivable,
  };
}
