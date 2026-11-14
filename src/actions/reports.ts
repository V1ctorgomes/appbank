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
  rentalsPending: number;
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
      rentals: {
        where: { deletedAt: null, status: "ACTIVE" },
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
    },
    orderBy: { name: "asc" },
  });

  const items: AccountsReceivableItem[] = [];

  for (const client of clients) {
    const pendingInstallments = client.sales.flatMap((s) => s.installments);
    const salesPending = pendingInstallments.reduce(
      (sum, i) => sum + Number(i.value),
      0
    );
    const loansPending = client.loans.reduce(
      (sum, loan) => sum + Number(loan.remainingBalance),
      0
    );
    const rentalInstallments = client.rentals.flatMap((r) => r.installments);
    const rentalsPending = rentalInstallments.reduce(
      (sum, i) => sum + Number(i.value),
      0
    );
    const pendingValue = salesPending + loansPending + rentalsPending;
    if (pendingValue <= 0) continue;

    const dueDates: Date[] = [
      ...pendingInstallments.map((i) => i.dueDate),
      ...rentalInstallments.map((i) => i.dueDate),
    ];
    for (const loan of client.loans) {
      if (isInstallmentFrequency(loan.paymentFrequency)) {
        for (const inst of loan.installments) dueDates.push(inst.dueDate);
      } else if (Number(loan.remainingBalance) > 0) {
        dueDates.push(nextLoanDueDate(loan.paymentDay, loan.billingStartMonth));
      }
    }
    dueDates.sort((a, b) => a.getTime() - b.getTime());

    const loanOpenCount = client.loans.reduce((count, loan) => {
      if (isInstallmentFrequency(loan.paymentFrequency)) {
        return count + loan.installments.length;
      }
      return count + (Number(loan.remainingBalance) > 0 ? 1 : 0);
    }, 0);

    items.push({
      clientId: client.id,
      clientName: client.name,
      pendingValue,
      salesPending,
      loansPending,
      rentalsPending,
      pendingCount:
        pendingInstallments.length + loanOpenCount + rentalInstallments.length,
      nextDue: dueDates[0] ?? null,
    });
  }

  return items.sort((a, b) => b.pendingValue - a.pendingValue);
}

export async function getRentalReportMetrics(filters: TransactionFilters = {}) {
  const user = await requireAuth();

  const start = filters.startDate
    ? new Date(filters.startDate + "T00:00:00")
    : undefined;
  const end = filters.endDate
    ? new Date(filters.endDate + "T23:59:59")
    : undefined;

  const [activeCount, openAgg, receivedAgg, transferredCount, returnedCount] =
    await Promise.all([
      prisma.rental.count({
        where: { userId: user.id, deletedAt: null, status: "ACTIVE" },
      }),
      prisma.rentalInstallment.aggregate({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "OVERDUE"] },
          rental: { userId: user.id, deletedAt: null, status: "ACTIVE" },
        },
        _sum: { value: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: {
          userId: user.id,
          deletedAt: null,
          origin: "RENTAL_PAYMENT",
          type: "INCOME",
          ...(start || end
            ? {
                date: {
                  ...(start ? { gte: start } : {}),
                  ...(end ? { lte: end } : {}),
                },
              }
            : {}),
        },
        _sum: { value: true },
        _count: true,
      }),
      prisma.rental.count({
        where: { userId: user.id, deletedAt: null, status: "TRANSFERRED" },
      }),
      prisma.rental.count({
        where: { userId: user.id, deletedAt: null, status: "RETURNED" },
      }),
    ]);

  return {
    activeCount,
    openValue: Number(openAgg._sum.value ?? 0),
    openCount: openAgg._count,
    receivedInPeriod: Number(receivedAgg._sum.value ?? 0),
    receivedCount: receivedAgg._count,
    transferredCount,
    returnedCount,
  };
}

export async function getReportData(filters: TransactionFilters = {}) {
  await requireAuth();

  const [summary, transactions, accountsReceivable, rentalMetrics] =
    await Promise.all([
      getTransactionSummary(filters),
      getAllTransactions(filters),
      getAccountsReceivable(),
      getRentalReportMetrics(filters),
    ]);

  const totalSalesReceivable = accountsReceivable.reduce(
    (sum, a) => sum + a.salesPending,
    0
  );
  const totalLoansReceivable = accountsReceivable.reduce(
    (sum, a) => sum + a.loansPending,
    0
  );
  const totalRentalsReceivable = accountsReceivable.reduce(
    (sum, a) => sum + a.rentalsPending,
    0
  );
  const totalReceivable =
    totalSalesReceivable + totalLoansReceivable + totalRentalsReceivable;

  return {
    summary,
    transactions,
    accountsReceivable,
    totalReceivable,
    totalSalesReceivable,
    totalLoansReceivable,
    totalRentalsReceivable,
    rentalMetrics,
  };
}
