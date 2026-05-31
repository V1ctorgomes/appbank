"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createSaleSchema, type CreateSaleInput } from "@/lib/schemas";
import {
  calcItemTotal,
  calcSaleTotalFromItems,
  generateAutoInstallments,
  validateInstallmentSum,
} from "@/lib/sale-utils";

export async function getSales() {
  const user = await requireAuth();

  return prisma.sale.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      client: true,
      items: true,
      installments: {
        where: { deletedAt: null },
        orderBy: { number: "asc" },
      },
    },
    orderBy: { saleDate: "desc" },
  });
}

export async function getSale(id: string) {
  const user = await requireAuth();

  return prisma.sale.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      client: true,
      items: true,
      installments: {
        where: { deletedAt: null },
        orderBy: { number: "asc" },
        include: { payment: true },
      },
    },
  });
}

export async function getClientsForSelect() {
  const user = await requireAuth();

  return prisma.client.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

function resolveInstallments(input: CreateSaleInput, totalValue: number) {
  if (input.paymentType === "CASH") {
    return [
      {
        number: 1,
        value: totalValue,
        dueDate: input.saleDate,
      },
    ];
  }

  if (input.installmentMode === "AUTO") {
    return generateAutoInstallments(
      totalValue,
      input.installmentCount!,
      input.firstDueDate!
    );
  }

  return (input.installments ?? []).map((inst, index) => ({
    number: index + 1,
    value: inst.value,
    dueDate: inst.dueDate,
  }));
}

function resolveTotalValue(input: CreateSaleInput): number {
  if (input.type === "DIRECT_VALUE") {
    return input.directValue!;
  }
  return calcSaleTotalFromItems(input.items ?? []);
}

export async function createSale(input: CreateSaleInput) {
  const user = await requireAuth();

  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  const totalValue = resolveTotalValue(data);

  if (totalValue <= 0) {
    return { error: "O valor total da venda deve ser maior que zero" };
  }

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, userId: user.id, deletedAt: null },
  });
  if (!client) {
    return { error: "Cliente não encontrado" };
  }

  const installments = resolveInstallments(data, totalValue);

  if (!validateInstallmentSum(installments, totalValue)) {
    return { error: "A soma das parcelas deve ser igual ao valor total da venda" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sale = await prisma.sale.create({
    data: {
      userId: user.id,
      clientId: data.clientId,
      type: data.type,
      description: data.type === "DIRECT_VALUE" ? data.description : null,
      saleDate: new Date(data.saleDate + "T12:00:00"),
      notes: data.notes || null,
      totalValue,
      items:
        data.type === "ITEMS"
          ? {
              create: (data.items ?? []).map((item) => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: calcItemTotal(item.quantity, item.unitPrice),
              })),
            }
          : undefined,
      installments: {
        create: installments.map((inst) => {
          const dueDate = new Date(inst.dueDate + "T12:00:00");
          const isOverdue = dueDate < today;
          return {
            number: inst.number,
            value: inst.value,
            dueDate,
            status: isOverdue ? "OVERDUE" : "PENDING",
          };
        }),
      },
    },
  });

  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${data.clientId}`);

  return { success: true, saleId: sale.id };
}

export async function deleteSale(id: string) {
  const user = await requireAuth();

  const sale = await prisma.sale.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      installments: {
        where: { deletedAt: null, status: "PAID" },
      },
    },
  });

  if (!sale) {
    return { error: "Venda não encontrada" };
  }

  if (sale.installments.length > 0) {
    return {
      error: "Não é possível excluir venda com parcelas pagas",
      requiresConfirmation: true,
    };
  }

  await prisma.$transaction([
    prisma.installment.updateMany({
      where: { saleId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.sale.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);

  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/clientes");

  return { success: true };
}

export async function forceDeleteSale(id: string) {
  const user = await requireAuth();

  const sale = await prisma.sale.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!sale) {
    return { error: "Venda não encontrada" };
  }

  await prisma.$transaction([
    prisma.installment.updateMany({
      where: { saleId: id, deletedAt: null },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    }),
    prisma.sale.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);

  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/clientes");

  return { success: true };
}
