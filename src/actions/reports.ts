"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  getTransactions,
  getTransactionSummary,
  type TransactionFilters,
} from "@/actions/transactions";

export async function getAccountsReceivable() {
  const user = await requireAuth();

  const clients = await prisma.client.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      sales: {
        where: { deletedAt: null },
        include: {
          installments: {
            where: {
              deletedAt: null,
              status: { in: ["PENDING", "OVERDUE"] },
            },
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return clients
    .map((client) => {
      const pendingInstallments = client.sales.flatMap((s) => s.installments);
      if (pendingInstallments.length === 0) return null;

      const pendingValue = pendingInstallments.reduce(
        (sum, i) => sum + Number(i.value),
        0
      );
      const nextDue = pendingInstallments[0]?.dueDate ?? null;

      return {
        clientId: client.id,
        clientName: client.name,
        pendingValue,
        pendingCount: pendingInstallments.length,
        nextDue,
      };
    })
    .filter(Boolean) as {
    clientId: string;
    clientName: string;
    pendingValue: number;
    pendingCount: number;
    nextDue: Date;
  }[];
}

export async function getReportData(filters: TransactionFilters = {}) {
  await requireAuth();

  const [summary, transactions, accountsReceivable] = await Promise.all([
    getTransactionSummary(filters),
    getTransactions(filters),
    getAccountsReceivable(),
  ]);

  const totalReceivable = accountsReceivable.reduce(
    (sum, a) => sum + a.pendingValue,
    0
  );

  return {
    summary,
    transactions,
    accountsReceivable,
    totalReceivable,
  };
}
