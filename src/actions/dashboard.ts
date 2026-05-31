"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { startOfMonth, endOfMonth, addDays } from "date-fns";

export async function getDashboardData() {
  const user = await requireAuth();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [transactions, pendingInstallments, overdueInstallments, upcomingInstallments] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { userId: user.id, deletedAt: null },
        select: { type: true, value: true, date: true },
      }),
      prisma.installment.findMany({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "OVERDUE"] },
          sale: { userId: user.id, deletedAt: null },
        },
        select: { value: true },
      }),
      prisma.installment.count({
        where: {
          deletedAt: null,
          status: "OVERDUE",
          sale: { userId: user.id, deletedAt: null },
        },
      }),
      prisma.installment.findMany({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "OVERDUE"] },
          dueDate: { gte: now, lte: addDays(now, 30) },
          sale: { userId: user.id, deletedAt: null },
        },
        include: {
          sale: {
            include: { client: true },
          },
        },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
    ]);

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.value), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.value), 0);

  const monthIncome = transactions
    .filter((t) => t.type === "INCOME" && t.date >= monthStart && t.date <= monthEnd)
    .reduce((sum, t) => sum + Number(t.value), 0);

  const monthExpense = transactions
    .filter((t) => t.type === "EXPENSE" && t.date >= monthStart && t.date <= monthEnd)
    .reduce((sum, t) => sum + Number(t.value), 0);

  const totalReceivable = pendingInstallments.reduce(
    (sum, i) => sum + Number(i.value),
    0
  );

  return {
    balance: totalIncome - totalExpense,
    monthIncome,
    monthExpense,
    totalReceivable,
    overdueCount: overdueInstallments,
    upcomingPayments: upcomingInstallments.map((i) => ({
      id: i.id,
      clientName: i.sale.client.name,
      value: Number(i.value),
      dueDate: i.dueDate,
    })),
  };
}

export async function updateOverdueInstallments() {
  const user = await requireAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.installment.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: today },
      deletedAt: null,
      sale: { userId: user.id },
    },
    data: { status: "OVERDUE" },
  });
}
