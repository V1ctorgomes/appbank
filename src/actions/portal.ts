"use server";

import { prisma } from "@/lib/prisma";
import { normalizeCpf, validateCpf } from "@/lib/validators";
import { syncOverdueInstallments } from "@/lib/installments";

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

export type PortalClientData = {
  clientName: string;
  totalDebt: number;
  totalPaid: number;
  overdueCount: number;
  pendingCount: number;
  nextDueDate: string | null;
  sales: PortalSale[];
};

export type PortalLookupResult =
  | { ok: true; data: PortalClientData }
  | { ok: false; error: string };

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

  const sales = await prisma.sale.findMany({
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
  });

  let totalDebt = 0;
  let totalPaid = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let nextDueDate: string | null = null;

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
          if (
            !nextDueDate ||
            dueDate < new Date(nextDueDate)
          ) {
            nextDueDate = dueDate.toISOString();
          }
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

  if (salesData.length === 0) {
    return {
      ok: true,
      data: {
        clientName: client.name,
        totalDebt: 0,
        totalPaid: 0,
        overdueCount: 0,
        pendingCount: 0,
        nextDueDate: null,
        sales: [],
      },
    };
  }

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
    },
  };
}
