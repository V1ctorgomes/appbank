"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { transactionSchema, type TransactionInput } from "@/lib/schemas";
import { PAGE_SIZE, parsePage, getTotalPages } from "@/lib/pagination";

export type TransactionFilters = {
  startDate?: string;
  endDate?: string;
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  search?: string;
};

function buildTransactionWhere(userId: string, filters: TransactionFilters = {}) {
  return {
    userId,
    deletedAt: null,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.startDate || filters.endDate
      ? {
          date: {
            ...(filters.startDate
              ? { gte: new Date(filters.startDate + "T00:00:00") }
              : {}),
            ...(filters.endDate
              ? { lte: new Date(filters.endDate + "T23:59:59") }
              : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { description: { contains: filters.search, mode: "insensitive" as const } },
            { notes: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export async function getAllTransactions(filters: TransactionFilters = {}) {
  const user = await requireAuth();

  return prisma.transaction.findMany({
    where: buildTransactionWhere(user.id, filters),
    select: {
      id: true,
      type: true,
      origin: true,
      description: true,
      value: true,
      date: true,
      notes: true,
      categoryId: true,
      category: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getTransactions(
  filters: TransactionFilters = {},
  page?: string | number
) {
  const user = await requireAuth();
  const where = buildTransactionWhere(user.id, filters);

  const total = await prisma.transaction.count({ where });
  const totalPages = getTotalPages(total);
  const currentPage = Math.min(parsePage(page), totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const items = await prisma.transaction.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        origin: true,
        description: true,
        value: true,
        date: true,
        notes: true,
        categoryId: true,
        category: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

  return {
    items,
    total,
    page: currentPage,
    totalPages: getTotalPages(total),
  };
}

export async function createTransaction(input: TransactionInput) {
  const user = await requireAuth();

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        userId: user.id,
        type: parsed.data.type === "INCOME" ? "INCOME" : "EXPENSE",
        deletedAt: null,
      },
    });
    if (!category) {
      return { error: "Categoria inválida para este tipo" };
    }
  }

  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      origin: "MANUAL",
      description: parsed.data.description,
      categoryId: parsed.data.categoryId || null,
      value: parsed.data.value,
      date: new Date(parsed.data.date + "T12:00:00"),
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/movimentacoes");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  return { success: true };
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const user = await requireAuth();

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id, deletedAt: null, origin: "MANUAL" },
  });
  if (!existing) {
    return { error: "Movimentação não encontrada ou não editável" };
  }

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        userId: user.id,
        type: parsed.data.type === "INCOME" ? "INCOME" : "EXPENSE",
        deletedAt: null,
      },
    });
    if (!category) {
      return { error: "Categoria inválida para este tipo" };
    }
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      type: parsed.data.type,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId || null,
      value: parsed.data.value,
      date: new Date(parsed.data.date + "T12:00:00"),
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/movimentacoes");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const user = await requireAuth();

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id, deletedAt: null, origin: "MANUAL" },
  });
  if (!existing) {
    return { error: "Movimentação não encontrada ou não pode ser excluída" };
  }

  await prisma.transaction.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/movimentacoes");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  return { success: true };
}

export async function getTransactionSummary(filters: TransactionFilters = {}) {
  const user = await requireAuth();
  const where = buildTransactionWhere(user.id, filters);

  const [incomeAgg, expenseAgg, count] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: "INCOME" },
      _sum: { value: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "EXPENSE" },
      _sum: { value: true },
    }),
    prisma.transaction.count({ where }),
  ]);

  const income = Number(incomeAgg._sum.value ?? 0);
  const expense = Number(expenseAgg._sum.value ?? 0);

  return { income, expense, balance: income - expense, count };
}
