"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { clientSchema } from "@/lib/schemas";
import { normalizeCpf, normalizePhone } from "@/lib/validators";
import { PAGE_SIZE, parsePage, getTotalPages } from "@/lib/pagination";

export async function getClients(search?: string, page?: string | number) {
  const user = await requireAuth();
  const term = search?.trim() ?? "";
  const digits = term.replace(/\D/g, "");

  const where = {
    userId: user.id,
    deletedAt: null,
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" as const } },
            ...(digits
              ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }]
              : []),
          ],
        }
      : {}),
  };

  const total = await prisma.client.count({ where });
  const totalPages = getTotalPages(total);
  const currentPage = Math.min(parsePage(page), totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const items = await prisma.client.findMany({
    where,
    orderBy: { name: "asc" },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      phone: true,
      cpf: true,
    },
  });

  const saleBalances = new Map<string, number>();
  const loanBalances = new Map<string, number>();
  if (items.length > 0) {
    const clientIds = items.map((client) => client.id);
    const [saleRows, loanRows] = await Promise.all([
      prisma.$queryRaw<Array<{ clientId: string; balance: unknown }>>(
        Prisma.sql`
          SELECT s."clientId" AS "clientId", COALESCE(SUM(i."value"), 0) AS balance
          FROM "Sale" s
          INNER JOIN "Installment" i ON i."saleId" = s."id"
          WHERE s."userId" = ${user.id}
            AND s."deletedAt" IS NULL
            AND i."deletedAt" IS NULL
            AND i."status"::text IN ('PENDING', 'OVERDUE')
            AND s."clientId" IN (${Prisma.join(clientIds)})
          GROUP BY s."clientId"
        `
      ),
      prisma.$queryRaw<Array<{ clientId: string; balance: unknown }>>(
        Prisma.sql`
          SELECT l."clientId" AS "clientId", COALESCE(SUM(l."remainingBalance"), 0) AS balance
          FROM "Loan" l
          WHERE l."userId" = ${user.id}
            AND l."deletedAt" IS NULL
            AND l."status"::text = 'ACTIVE'
            AND l."clientId" IN (${Prisma.join(clientIds)})
          GROUP BY l."clientId"
        `
      ),
    ]);
    for (const row of saleRows) saleBalances.set(row.clientId, Number(row.balance));
    for (const row of loanRows) loanBalances.set(row.clientId, Number(row.balance));
  }

  return {
    items: items.map((client) => {
      const salesBalance = saleBalances.get(client.id) ?? 0;
      const loansBalance = loanBalances.get(client.id) ?? 0;
      return {
        ...client,
        salesBalance,
        loansBalance,
        balance: salesBalance + loansBalance,
      };
    }),
    total,
    page: currentPage,
    totalPages: getTotalPages(total),
  };
}

export async function getClient(id: string) {
  const user = await requireAuth();

  return prisma.client.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      phone: true,
      cpf: true,
      notes: true,
      sales: {
        where: { deletedAt: null },
        orderBy: { saleDate: "desc" },
        select: {
          id: true,
          type: true,
          saleDate: true,
          totalValue: true,
          installments: {
            where: { deletedAt: null },
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              value: true,
              dueDate: true,
              status: true,
            },
          },
        },
      },
      loans: {
        where: { deletedAt: null },
        orderBy: { loanDate: "desc" },
        select: {
          id: true,
          loanDate: true,
          principal: true,
          remainingBalance: true,
          status: true,
          interestRate: true,
          paymentFrequency: true,
        },
      },
    },
  });
}

export async function getClientForEdit(id: string) {
  const user = await requireAuth();

  return prisma.client.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      phone: true,
      cpf: true,
      notes: true,
    },
  });
}

export async function createClient(formData: FormData) {
  const user = await requireAuth();

  const raw = {
    name: formData.get("name") as string,
    phone: formData.get("phone") as string,
    cpf: formData.get("cpf") as string,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const cpf = normalizeCpf(parsed.data.cpf);
  const phone = normalizePhone(parsed.data.phone);

  const existing = await prisma.client.findFirst({
    where: { userId: user.id, cpf, deletedAt: null },
  });
  if (existing) {
    return { error: "CPF já cadastrado" };
  }

  await prisma.client.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      phone,
      cpf,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function updateClient(id: string, formData: FormData) {
  const user = await requireAuth();

  const raw = {
    name: formData.get("name") as string,
    phone: formData.get("phone") as string,
    cpf: formData.get("cpf") as string,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const cpf = normalizeCpf(parsed.data.cpf);
  const phone = normalizePhone(parsed.data.phone);

  const existing = await prisma.client.findFirst({
    where: { userId: user.id, cpf, deletedAt: null, NOT: { id } },
  });
  if (existing) {
    return { error: "CPF já cadastrado" };
  }

  await prisma.client.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: {
      name: parsed.data.name,
      phone,
      cpf,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function deleteClient(id: string) {
  const user = await requireAuth();

  await prisma.client.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}
