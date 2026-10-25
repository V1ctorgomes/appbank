"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { startOfMonth, endOfMonth, addDays, startOfDay } from "date-fns";
import {
  calcMonthlyInterest,
  isMonthlyLoanInterestCovered,
  loanDueDateForMonth,
} from "@/lib/loan-utils";

function sumDecimal(value: { _sum: { value: unknown } }) {
  return Number(value._sum.value ?? 0);
}

export type DashboardUpcomingPayment = {
  id: string;
  clientName: string;
  value: number;
  dueDate: Date | string;
  kind?: "sale" | "loan" | "loan_installment";
  label?: string;
};

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
      kind: "sale" as const,
      label: "Parcela de venda",
    })),
  };
}

export async function getDashboardLoanData() {
  const user = await requireAuth();
  const userId = user.id;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const today = startOfDay(now);
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const horizon = addDays(now, 30);

  const [
    activeCount,
    portfolioAgg,
    monthReceived,
    monthDisbursed,
    overdueLoanInstallments,
    upcomingLoanInstallments,
    monthlyLoans,
  ] = await Promise.all([
    prisma.loan.count({
      where: { userId, deletedAt: null, status: "ACTIVE" },
    }),
    prisma.loan.aggregate({
      where: { userId, deletedAt: null, status: "ACTIVE" },
      _sum: { remainingBalance: true },
    }),
    prisma.loanPayment.aggregate({
      where: {
        deletedAt: null,
        paymentDate: { gte: monthStart, lte: monthEnd },
        loan: { userId, deletedAt: null },
      },
      _sum: { totalValue: true },
    }),
    prisma.loan.aggregate({
      where: {
        userId,
        deletedAt: null,
        loanDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { principal: true },
    }),
    prisma.loanInstallment.findMany({
      where: {
        deletedAt: null,
        loan: { userId, deletedAt: null, status: "ACTIVE" },
        OR: [
          { status: "OVERDUE" },
          { status: "PENDING", dueDate: { lt: today } },
        ],
      },
      select: {
        id: true,
        value: true,
        dueDate: true,
        number: true,
        loan: { select: { client: { select: { name: true } } } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.loanInstallment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: today, lte: horizon },
        loan: { userId, deletedAt: null, status: "ACTIVE" },
      },
      select: {
        id: true,
        value: true,
        dueDate: true,
        number: true,
        loan: { select: { client: { select: { name: true } } } },
      },
      orderBy: { dueDate: "asc" },
      take: 15,
    }),
    prisma.loan.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "ACTIVE",
        paymentFrequency: "MONTHLY",
        billingStartMonth: { lte: monthEnd },
      },
      select: {
        id: true,
        remainingBalance: true,
        interestRate: true,
        paymentDay: true,
        billingStartMonth: true,
        client: { select: { name: true } },
        _count: {
          select: { payments: { where: { deletedAt: null } } },
        },
      },
    }),
  ]);

  let monthInterestDue = 0;
  let overdueMonthlyInterestCount = 0;
  const upcomingMonthly: DashboardUpcomingPayment[] = [];

  for (const loan of monthlyLoans) {
    const due = loanDueDateForMonth(
      loan.paymentDay,
      loan.billingStartMonth,
      year,
      monthIndex
    );
    if (!due) continue;

    if (
      isMonthlyLoanInterestCovered(
        loan.billingStartMonth,
        year,
        monthIndex,
        loan._count.payments
      )
    ) {
      continue;
    }

    const interest = calcMonthlyInterest(
      Number(loan.remainingBalance),
      Number(loan.interestRate)
    );
    monthInterestDue += interest;

    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay < today) {
      overdueMonthlyInterestCount += 1;
    }

    if (dueDay >= today && dueDay <= horizon) {
      upcomingMonthly.push({
        id: `loan-interest-${loan.id}`,
        clientName: loan.client.name,
        value: interest,
        dueDate: due,
        kind: "loan",
        label: "Juros do mês",
      });
    }
  }

  // Também considera juros mensais atrasados de meses anteriores ainda em aberto
  // (próximo vencimento histórico), para a contagem de atrasados.
  for (const loan of monthlyLoans) {
    const start = loan.billingStartMonth;
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();
    let unpaidIndex = 0;

    while (y < year || (y === year && m < monthIndex)) {
      unpaidIndex += 1;
      const covered = loan._count.payments >= unpaidIndex;
      if (!covered) {
        const pastDue = loanDueDateForMonth(loan.paymentDay, start, y, m);
        if (pastDue) {
          const d = new Date(pastDue);
          d.setHours(0, 0, 0, 0);
          if (d < today) {
            overdueMonthlyInterestCount += 1;
            // Não soma no "a receber no mês" — é de mês passado
          }
        }
      }
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      if (unpaidIndex > 120) break;
    }
  }

  const overdueInstallmentValue = overdueLoanInstallments.reduce(
    (sum, i) => sum + Number(i.value),
    0
  );

  const monthReceivableInstallments = await prisma.loanInstallment.aggregate({
    where: {
      deletedAt: null,
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: monthStart, lte: monthEnd },
      loan: { userId, deletedAt: null, status: "ACTIVE" },
    },
    _sum: { value: true },
  });

  const monthReceivable =
    monthInterestDue + Number(monthReceivableInstallments._sum.value ?? 0);

  const upcomingPayments: DashboardUpcomingPayment[] = [
    ...upcomingLoanInstallments.map((i) => ({
      id: i.id,
      clientName: i.loan.client.name,
      value: Number(i.value),
      dueDate: i.dueDate,
      kind: "loan_installment" as const,
      label: `Parcela #${i.number}`,
    })),
    ...upcomingMonthly,
  ]
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )
    .slice(0, 10);

  return {
    activeCount,
    portfolio: Number(portfolioAgg._sum.remainingBalance ?? 0),
    monthReceived: Number(monthReceived._sum.totalValue ?? 0),
    monthDisbursed: Number(monthDisbursed._sum.principal ?? 0),
    monthReceivable,
    overdueCount: overdueLoanInstallments.length + overdueMonthlyInterestCount,
    overdueValue: overdueInstallmentValue,
    upcomingPayments,
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
