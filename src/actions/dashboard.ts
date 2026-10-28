"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { startOfMonth, endOfMonth, addDays, startOfDay } from "date-fns";
import {
  calcMonthlyInterest,
  countLoanBillingMonthsThrough,
  isMonthlyLoanInterestCovered,
  loanDueDateForMonth,
} from "@/lib/loan-utils";
import { calendarDateKey, formatDateForInput } from "@/lib/utils";

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

export async function getDashboardSaleData() {
  const user = await requireAuth();
  const userId = user.id;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const today = startOfDay(now);

  const saleFilter = { userId, deletedAt: null };
  const openInstallmentFilter = {
    deletedAt: null,
    status: { in: ["PENDING", "OVERDUE"] as ("PENDING" | "OVERDUE")[] },
    sale: saleFilter,
  };
  const overdueFilter = {
    deletedAt: null,
    sale: saleFilter,
    OR: [
      { status: "OVERDUE" as const },
      { status: "PENDING" as const, dueDate: { lt: today } },
    ],
  };

  const [
    monthCount,
    monthSold,
    monthReceived,
    monthReceivable,
    openValue,
    openCount,
    overdueCount,
    overdueValue,
    upcomingInstallments,
  ] = await Promise.all([
    prisma.sale.count({
      where: {
        ...saleFilter,
        saleDate: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.sale.aggregate({
      where: {
        ...saleFilter,
        saleDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { totalValue: true },
    }),
    prisma.payment.aggregate({
      where: {
        deletedAt: null,
        paymentDate: { gte: monthStart, lte: monthEnd },
        installment: { deletedAt: null, sale: saleFilter },
      },
      _sum: { value: true },
    }),
    prisma.installment.aggregate({
      where: {
        ...openInstallmentFilter,
        dueDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { value: true },
    }),
    prisma.installment.aggregate({
      where: openInstallmentFilter,
      _sum: { value: true },
    }),
    prisma.sale.count({
      where: {
        ...saleFilter,
        installments: { some: openInstallmentFilter },
      },
    }),
    prisma.installment.count({ where: overdueFilter }),
    prisma.installment.aggregate({
      where: overdueFilter,
      _sum: { value: true },
    }),
    prisma.installment.findMany({
      where: {
        ...openInstallmentFilter,
        dueDate: { gte: today, lte: addDays(now, 30) },
      },
      select: {
        id: true,
        value: true,
        dueDate: true,
        number: true,
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

  return {
    monthCount,
    monthSold: Number(monthSold._sum.totalValue ?? 0),
    monthReceived: Number(monthReceived._sum.value ?? 0),
    monthReceivable: Number(monthReceivable._sum.value ?? 0),
    openValue: Number(openValue._sum.value ?? 0),
    openCount,
    overdueCount,
    overdueValue: Number(overdueValue._sum.value ?? 0),
    upcomingPayments: upcomingInstallments.map((i) => ({
      id: i.id,
      clientName: i.sale.client.name,
      value: Number(i.value),
      dueDate: i.dueDate,
      kind: "sale" as const,
      label: `Parcela #${i.number}`,
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

export type DashboardCalendarStatus = "receive" | "received" | "overdue";

export type DashboardCalendarItem = {
  id: string;
  clientName: string;
  label: string;
  value: number;
  status: DashboardCalendarStatus;
};

export type DashboardCalendarDay = {
  date: string;
  status: DashboardCalendarStatus;
  total: number;
  count: number;
  items: DashboardCalendarItem[];
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthBounds(month?: string) {
  const current = calendarDateKey().slice(0, 7);
  const key = month && /^\d{4}-\d{2}$/.test(month) ? month : current;
  const [year, monthNumber] = key.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  return {
    key,
    year,
    monthIndex,
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 0)),
  };
}

export async function getDashboardCalendar(viewInput?: string, month?: string) {
  const user = await requireAuth();
  const userId = user.id;
  const view =
    viewInput === "vendas" || viewInput === "emprestimos" ? viewInput : "geral";
  const { key, year, monthIndex, start, end } = monthBounds(month);
  const today = calendarDateKey();
  const includeSales = view !== "emprestimos";
  const includeLoans = view !== "vendas";
  const saleFilter = { userId, deletedAt: null };

  const buckets = new Map<string, DashboardCalendarDay>();

  function addItem(date: string, item: DashboardCalendarItem) {
    const bucket = buckets.get(date);
    if (!bucket) {
      buckets.set(date, {
        date,
        status: item.status,
        total: item.value,
        count: 1,
        items: [item],
      });
      return;
    }

    bucket.items.push(item);
    bucket.total += item.value;
    bucket.count += 1;
    if (item.status === "overdue") bucket.status = "overdue";
    else if (item.status === "receive" && bucket.status === "received") {
      bucket.status = "receive";
    }
  }

  function openStatus(date: string, status: string): DashboardCalendarStatus {
    if (status === "PAID") return "received";
    if (status === "OVERDUE" || date < today) return "overdue";
    return "receive";
  }

  const [saleInstallments, loanInstallments, monthlyLoans] = await Promise.all([
    includeSales
      ? prisma.installment.findMany({
          where: {
            deletedAt: null,
            status: { in: ["PENDING", "OVERDUE", "PAID"] },
            dueDate: { gte: start, lte: end },
            sale: saleFilter,
          },
          select: {
            id: true,
            number: true,
            value: true,
            dueDate: true,
            status: true,
            sale: { select: { client: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    includeLoans
      ? prisma.loanInstallment.findMany({
          where: {
            deletedAt: null,
            status: { in: ["PENDING", "OVERDUE", "PAID"] },
            dueDate: { gte: start, lte: end },
            loan: { userId, deletedAt: null, status: { in: ["ACTIVE", "SETTLED"] } },
          },
          select: {
            id: true,
            number: true,
            value: true,
            dueDate: true,
            status: true,
            loan: { select: { client: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    includeLoans
      ? prisma.loan.findMany({
          where: {
            userId,
            deletedAt: null,
            status: { in: ["ACTIVE", "SETTLED"] },
            paymentFrequency: "MONTHLY",
            billingStartMonth: { lte: end },
          },
          select: {
            id: true,
            status: true,
            remainingBalance: true,
            interestRate: true,
            paymentDay: true,
            billingStartMonth: true,
            client: { select: { name: true } },
            payments: {
              where: { deletedAt: null },
              orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
              select: { interestValue: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  for (const installment of saleInstallments) {
    const date = formatDateForInput(installment.dueDate);
    addItem(date, {
      id: installment.id,
      clientName: installment.sale.client.name,
      label:
        view === "geral"
          ? `Venda · Parcela #${installment.number}`
          : `Parcela #${installment.number}`,
      value: Number(installment.value),
      status: openStatus(date, installment.status),
    });
  }

  for (const installment of loanInstallments) {
    const date = formatDateForInput(installment.dueDate);
    addItem(date, {
      id: installment.id,
      clientName: installment.loan.client.name,
      label:
        view === "geral"
          ? `Empréstimo · Parcela #${installment.number}`
          : `Parcela #${installment.number}`,
      value: Number(installment.value),
      status: openStatus(date, installment.status),
    });
  }

  for (const loan of monthlyLoans) {
    const due = loanDueDateForMonth(
      loan.paymentDay,
      loan.billingStartMonth,
      year,
      monthIndex
    );
    if (!due) continue;

    const date = localDateKey(due);
    const covered = isMonthlyLoanInterestCovered(
      loan.billingStartMonth,
      year,
      monthIndex,
      loan.payments.length
    );
    const label = view === "geral" ? "Empréstimo · Juros do mês" : "Juros do mês";

    if (covered) {
      const monthNumber = countLoanBillingMonthsThrough(
        loan.billingStartMonth,
        year,
        monthIndex
      );
      const payment = loan.payments[monthNumber - 1];
      addItem(date, {
        id: `loan-interest-${loan.id}-${date}`,
        clientName: loan.client.name,
        label,
        value: Number(payment?.interestValue ?? 0),
        status: "received",
      });
      continue;
    }

    if (loan.status !== "ACTIVE") continue;

    addItem(date, {
      id: `loan-interest-${loan.id}-${date}`,
      clientName: loan.client.name,
      label,
      value: calcMonthlyInterest(
        Number(loan.remainingBalance),
        Number(loan.interestRate)
      ),
      status: date < today ? "overdue" : "receive",
    });
  }

  const days = Array.from(buckets.values())
    .map((day) => ({
      ...day,
      total:
        Math.round(
          day.items
            .filter((item) => item.status === day.status)
            .reduce((sum, item) => sum + item.value, 0) * 100
        ) / 100,
      items: day.items.sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR")),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { month: key, days };
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
