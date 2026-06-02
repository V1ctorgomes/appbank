"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { startOfMonth, endOfMonth, addDays, startOfDay } from "date-fns";

function sumDecimal(value: { _sum: { value: unknown } }) {
  return Number(value._sum.value ?? 0);
}

export async function getDashboardData() {
  const user = await requireAuth();
  const userId = user.id;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const today = startOfDay(now);

  const saleFilter = { userId, deletedAt: null };

  const [
    totalIncome,
    totalExpense,
    monthIncome,
    monthExpense,
    totalReceivable,
    overdueCount,
    upcomingInstallments,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, deletedAt: null, type: "INCOME" },
      _sum: { value: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, deletedAt: null, type: "EXPENSE" },
      _sum: { value: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        deletedAt: null,
        type: "INCOME",
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { value: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        deletedAt: null,
        type: "EXPENSE",
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { value: true },
    }),
    prisma.installment.aggregate({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: monthStart, lte: monthEnd },
        sale: saleFilter,
      },
      _sum: { value: true },
    }),
    prisma.installment.count({
      where: {
        deletedAt: null,
        sale: saleFilter,
        OR: [
          { status: "OVERDUE" },
          { status: "PENDING", dueDate: { lt: today } },
        ],
      },
    }),
    prisma.installment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: today, lte: addDays(now, 30) },
        sale: saleFilter,
      },
      select: {
        id: true,
        value: true,
        dueDate: true,
        sale: {
          select: {
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const income = sumDecimal(totalIncome);
  const expense = sumDecimal(totalExpense);

  return {
    balance: income - expense,
    monthIncome: sumDecimal(monthIncome),
    monthExpense: sumDecimal(monthExpense),
    totalReceivable: sumDecimal(totalReceivable),
    overdueCount,
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
  const today = startOfDay(new Date());

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
