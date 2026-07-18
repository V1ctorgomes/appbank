"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { syncOverdueInstallments } from "@/lib/installments";
import { parseMonthFilter } from "@/lib/month-filter";
import {
  calcMonthlyInterest,
  loanDueDateForMonth,
  loanPaymentTypeLabel,
} from "@/lib/loan-utils";

export type RecebimentoTipo = "todos" | "vendas" | "emprestimos";

export type PendingRecebimento = {
  kind: "sale" | "loan";
  id: string;
  clientId: string;
  clientName: string;
  label: string;
  value: number;
  dueDate: string;
  status: string;
  href: string;
  saleId?: string;
  installmentNumber?: number;
  loan?: {
    remainingBalance: number;
    interestRate: number;
    paymentDay: number;
    billingStartMonth: string;
  };
};

export type HistoryRecebimento = {
  kind: "sale" | "loan";
  id: string;
  paymentDate: string;
  clientName: string;
  label: string;
  value: number;
  notes: string | null;
  href: string;
};

export function parseRecebimentoTipo(tipo?: string): RecebimentoTipo {
  if (tipo === "vendas" || tipo === "emprestimos") return tipo;
  return "todos";
}

export async function getPendingRecebimentos(
  month?: string,
  tipo: RecebimentoTipo = "todos"
) {
  const user = await requireAuth();
  await syncOverdueInstallments(user.id);

  const { start, end, key } = parseMonthFilter(month);
  const [year, monthNum] = key.split("-").map(Number);
  const monthIndex = monthNum - 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items: PendingRecebimento[] = [];

  if (tipo === "todos" || tipo === "vendas") {
    const installments = await prisma.installment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: start, lte: end },
        sale: { userId: user.id, deletedAt: null },
      },
      select: {
        id: true,
        number: true,
        value: true,
        dueDate: true,
        status: true,
        saleId: true,
        sale: {
          select: {
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    });

    for (const inst of installments) {
      items.push({
        kind: "sale",
        id: inst.id,
        clientId: inst.sale.client.id,
        clientName: inst.sale.client.name,
        label: `Parcela #${inst.number}`,
        value: Number(inst.value),
        dueDate: inst.dueDate.toISOString(),
        status: inst.status,
        href: `/vendas/${inst.saleId}`,
        saleId: inst.saleId,
        installmentNumber: inst.number,
      });
    }
  }

  if (tipo === "todos" || tipo === "emprestimos") {
    const loans = await prisma.loan.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        status: "ACTIVE",
        billingStartMonth: { lte: end },
      },
      select: {
        id: true,
        remainingBalance: true,
        interestRate: true,
        paymentDay: true,
        billingStartMonth: true,
        client: { select: { id: true, name: true } },
        payments: {
          where: {
            deletedAt: null,
            paymentDate: { gte: start, lte: end },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    for (const loan of loans) {
      if (loan.payments.length > 0) continue;

      const due = loanDueDateForMonth(
        loan.paymentDay,
        loan.billingStartMonth,
        year,
        monthIndex
      );
      if (!due) continue;

      const interest = calcMonthlyInterest(
        Number(loan.remainingBalance),
        Number(loan.interestRate)
      );
      const dueDay = new Date(due);
      dueDay.setHours(0, 0, 0, 0);
      const status = dueDay < today ? "OVERDUE" : "PENDING";

      items.push({
        kind: "loan",
        id: loan.id,
        clientId: loan.client.id,
        clientName: loan.client.name,
        label: "Juros do mês",
        value: interest,
        dueDate: due.toISOString(),
        status,
        href: `/emprestimos/${loan.id}`,
        loan: {
          remainingBalance: Number(loan.remainingBalance),
          interestRate: Number(loan.interestRate),
          paymentDay: loan.paymentDay,
          billingStartMonth: loan.billingStartMonth.toISOString(),
        },
      });
    }
  }

  items.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const totalValue = items.reduce((sum, i) => sum + i.value, 0);
  return { items, totalValue };
}

export async function getHistoryRecebimentos(
  month?: string,
  tipo: RecebimentoTipo = "todos"
) {
  const user = await requireAuth();
  const { start, end } = parseMonthFilter(month);
  const items: HistoryRecebimento[] = [];

  if (tipo === "todos" || tipo === "vendas") {
    const payments = await prisma.payment.findMany({
      where: {
        deletedAt: null,
        paymentDate: { gte: start, lte: end },
        installment: {
          sale: { userId: user.id },
        },
      },
      include: {
        installment: {
          include: {
            sale: {
              include: { client: true },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    for (const payment of payments) {
      items.push({
        kind: "sale",
        id: payment.id,
        paymentDate: payment.paymentDate.toISOString(),
        clientName: payment.installment.sale.client.name,
        label: `Parcela #${payment.installment.number}`,
        value: Number(payment.value),
        notes: payment.notes,
        href: `/vendas/${payment.installment.saleId}`,
      });
    }
  }

  if (tipo === "todos" || tipo === "emprestimos") {
    const loanPayments = await prisma.loanPayment.findMany({
      where: {
        deletedAt: null,
        paymentDate: { gte: start, lte: end },
        loan: { userId: user.id, deletedAt: null },
      },
      include: {
        loan: {
          include: { client: true },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    for (const payment of loanPayments) {
      items.push({
        kind: "loan",
        id: payment.id,
        paymentDate: payment.paymentDate.toISOString(),
        clientName: payment.loan.client.name,
        label: loanPaymentTypeLabel(payment.type),
        value: Number(payment.totalValue),
        notes: payment.notes,
        href: `/emprestimos/${payment.loanId}`,
      });
    }
  }

  items.sort(
    (a, b) =>
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

  const totalValue = items.reduce((sum, i) => sum + i.value, 0);
  return { items, totalValue };
}
