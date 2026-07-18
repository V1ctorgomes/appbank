"use server";

import { prisma } from "@/lib/prisma";
import { normalizeCpf, validateCpf } from "@/lib/validators";
import { syncOverdueInstallments } from "@/lib/installments";
import { calcMonthlyInterest } from "@/lib/loan-utils";

export type PortalInstallment = {
  number: number;
  value: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
};

export type PortalSale = {
  saleDate: string;
  totalValue: number;
  description: string | null;
  installments: PortalInstallment[];
};

export type PortalLoan = {
  loanDate: string;
  principal: number;
  remainingBalance: number;
  interestRate: number;
  paymentDay: number;
  monthlyInterest: number;
  settleTotal: number;
  status: string;
  nextDueDate: string;
};

export type PortalClientData = {
  clientName: string;
  totalDebt: number;
  totalPaid: number;
  overdueCount: number;
  pendingCount: number;
  nextDueDate: string | null;
  sales: PortalSale[];
  loans: PortalLoan[];
};

export type PortalLookupResult =
  | { ok: true; data: PortalClientData }
  | { ok: false; error: string };

function nextLoanDueDate(paymentDay: number, from = new Date()): Date {
  const year = from.getFullYear();
  const month = from.getMonth();
  const todayDay = from.getDate();

  const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  if (todayDay <= paymentDay) {
    const day = Math.min(paymentDay, daysIn(year, month));
    return new Date(year, month, day, 12, 0, 0);
  }

  const nextMonth = month + 1;
  const y = nextMonth > 11 ? year + 1 : year;
  const m = nextMonth % 12;
  const day = Math.min(paymentDay, daysIn(y, m));
  return new Date(y, m, day, 12, 0, 0);
}

export async function lookupClientByCpf(cpf: string): Promise<PortalLookupResult> {
  const digits = normalizeCpf(cpf);

  if (digits.length !== 11) {
    return { ok: false, error: "Informe um CPF com 11 dígitos." };
  }

  if (!validateCpf(digits)) {
    return { ok: false, error: "CPF inválido. Verifique os números digitados." };
  }

  const portalUserId = process.env.PORTAL_USER_ID?.trim();

  const clients = await prisma.client.findMany({
    where: {
      cpf: digits,
      deletedAt: null,
      ...(portalUserId ? { userId: portalUserId } : {}),
    },
    select: { id: true, userId: true, name: true },
  });

  if (clients.length === 0) {
    return { ok: false, error: "CPF não encontrado em nossa base." };
  }

  if (clients.length > 1) {
    return {
      ok: false,
      error: "Não foi possível concluir a consulta. Entre em contato conosco.",
    };
  }

  const client = clients[0];
  await syncOverdueInstallments(client.userId);

  const [sales, loans] = await Promise.all([
    prisma.sale.findMany({
      where: {
        clientId: client.id,
        deletedAt: null,
      },
      orderBy: { saleDate: "desc" },
      select: {
        saleDate: true,
        totalValue: true,
        description: true,
        installments: {
          where: { deletedAt: null, status: { not: "CANCELLED" } },
          orderBy: { number: "asc" },
          select: {
            number: true,
            value: true,
            dueDate: true,
            status: true,
            paidAt: true,
          },
        },
      },
    }),
    prisma.loan.findMany({
      where: {
        clientId: client.id,
        deletedAt: null,
        status: "ACTIVE",
      },
      orderBy: { loanDate: "desc" },
      select: {
        loanDate: true,
        principal: true,
        remainingBalance: true,
        interestRate: true,
        paymentDay: true,
        status: true,
      },
    }),
  ]);

  let totalDebt = 0;
  let totalPaid = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let nextDueDate: string | null = null;

  function considerNextDue(due: Date) {
    const iso = due.toISOString();
    if (!nextDueDate || due < new Date(nextDueDate)) {
      nextDueDate = iso;
    }
  }

  const salesData: PortalSale[] = sales
    .filter((s) => s.installments.length > 0)
    .map((sale) => {
      const installments: PortalInstallment[] = sale.installments.map((inst) => {
        const value = Number(inst.value);
        const dueDate = inst.dueDate;

        if (inst.status === "PAID") {
          totalPaid += value;
        } else if (inst.status === "PENDING" || inst.status === "OVERDUE") {
          totalDebt += value;
          if (inst.status === "OVERDUE") overdueCount += 1;
          if (inst.status === "PENDING") pendingCount += 1;
          considerNextDue(dueDate);
        }

        return {
          number: inst.number,
          value,
          dueDate: dueDate.toISOString(),
          status: inst.status,
          paidAt: inst.paidAt?.toISOString() ?? null,
        };
      });

      return {
        saleDate: sale.saleDate.toISOString(),
        totalValue: Number(sale.totalValue),
        description: sale.description,
        installments,
      };
    });

  const loansData: PortalLoan[] = loans.map((loan) => {
    const remainingBalance = Number(loan.remainingBalance);
    const interestRate = Number(loan.interestRate);
    const monthlyInterest = calcMonthlyInterest(remainingBalance, interestRate);
    const settleTotal = remainingBalance + monthlyInterest;
    const due = nextLoanDueDate(loan.paymentDay);

    totalDebt += remainingBalance;
    pendingCount += 1;
    considerNextDue(due);

    return {
      loanDate: loan.loanDate.toISOString(),
      principal: Number(loan.principal),
      remainingBalance,
      interestRate,
      paymentDay: loan.paymentDay,
      monthlyInterest,
      settleTotal,
      status: loan.status,
      nextDueDate: due.toISOString(),
    };
  });

  return {
    ok: true,
    data: {
      clientName: client.name,
      totalDebt,
      totalPaid,
      overdueCount,
      pendingCount,
      nextDueDate,
      sales: salesData,
      loans: loansData,
    },
  };
}
