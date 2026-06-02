"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { createSaleSchema, updateSaleSchema, type CreateSaleInput, type UpdateSaleInput } from "@/lib/schemas";
import {
  calcItemTotal,
  calcSaleTotalFromItems,
  formatMoneyBr,
  generateAutoInstallments,
  getInstallmentStatusForDate,
  roundMoney,
  validateInstallmentSum,
} from "@/lib/sale-utils";
import { PAGE_SIZE, parsePage, getTotalPages } from "@/lib/pagination";

export async function getSales(page?: string | number) {
  const user = await requireAuth();

  const where = { userId: user.id, deletedAt: null };

  const total = await prisma.sale.count({ where });
  const totalPages = getTotalPages(total);
  const currentPage = Math.min(parsePage(page), totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const items = await prisma.sale.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        saleDate: true,
        totalValue: true,
        client: { select: { id: true, name: true } },
        installments: {
          where: { deletedAt: null },
          select: { id: true, status: true, value: true },
          orderBy: { number: "asc" },
        },
      },
      orderBy: { saleDate: "desc" },
    });

  return {
    items,
    total,
    page: currentPage,
    totalPages: getTotalPages(total),
  };
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

function resolveTotalValueForUpdate(
  saleType: "ITEMS" | "DIRECT_VALUE",
  data: UpdateSaleInput
): number | null {
  if (saleType === "DIRECT_VALUE") {
    if (!data.directValue || data.directValue <= 0) return null;
    return data.directValue;
  }
  if (!data.items?.length) return null;
  return calcSaleTotalFromItems(data.items);
}

function resolveInstallmentsForUpdate(
  data: UpdateSaleInput,
  totalValue: number
): { number: number; value: number; dueDate: string }[] {
  if (data.paymentType === "CASH") {
    return [{ number: 1, value: totalValue, dueDate: data.saleDate }];
  }
  if (data.installmentMode === "AUTO") {
    return generateAutoInstallments(
      totalValue,
      data.installmentCount!,
      data.firstDueDate!
    );
  }
  return (data.installments ?? []).map((inst, index) => ({
    number: index + 1,
    value: inst.value,
    dueDate: inst.dueDate,
  }));
}

export async function updateSale(saleId: string, input: UpdateSaleInput) {
  const user = await requireAuth();

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, userId: user.id, deletedAt: null },
    include: {
      items: true,
      installments: {
        where: { deletedAt: null },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!sale) {
    return { error: "Venda não encontrada" };
  }

  const parsed = updateSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  const saleType = sale.type;

  if (saleType === "DIRECT_VALUE" && !data.description?.trim()) {
    return { error: "Descrição é obrigatória" };
  }
  if (saleType === "ITEMS" && !data.items?.length) {
    return { error: "Adicione pelo menos um item" };
  }

  const totalValue = resolveTotalValueForUpdate(saleType, data);
  if (!totalValue || totalValue <= 0) {
    return { error: "O valor total da venda deve ser maior que zero" };
  }

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, userId: user.id, deletedAt: null },
  });
  if (!client) {
    return { error: "Cliente não encontrado" };
  }

  const paidInstallments = sale.installments.filter((i) => i.status === "PAID");
  const unpaidInstallments = sale.installments.filter(
    (i) => i.status === "PENDING" || i.status === "OVERDUE"
  );
  const paidSum = roundMoney(
    paidInstallments.reduce((s, i) => s + Number(i.value), 0)
  );
  const allPaid = unpaidInstallments.length === 0 && paidInstallments.length > 0;
  const saleDate = new Date(data.saleDate + "T12:00:00");
  const oldClientId = sale.clientId;

  if (allPaid) {
    const clientOk = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id, deletedAt: null },
    });
    if (!clientOk) return { error: "Cliente não encontrado" };

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        clientId: data.clientId,
        saleDate,
        notes: data.notes || null,
      },
    });

    revalidatePath("/vendas");
    revalidatePath(`/vendas/${saleId}`);
    revalidatePath("/dashboard");
    revalidatePath("/clientes");
    if (oldClientId !== data.clientId) {
      revalidatePath(`/clientes/${oldClientId}`);
    }
    revalidatePath(`/clientes/${data.clientId}`);

    return { success: true };
  }

  if (totalValue < paidSum) {
    return {
      error: `O valor total não pode ser menor que o já recebido (${formatMoneyBr(paidSum)})`,
    };
  }

  try {
    if (paidInstallments.length === 0) {
      if (!data.paymentType) {
        return { error: "Informe a forma de pagamento" };
      }

      const installments = resolveInstallmentsForUpdate(data, totalValue);
      if (!validateInstallmentSum(installments, totalValue)) {
        return { error: "A soma das parcelas deve ser igual ao valor total da venda" };
      }

      await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: saleId },
          data: {
            clientId: data.clientId,
            saleDate,
            notes: data.notes || null,
            description: saleType === "DIRECT_VALUE" ? data.description : null,
            totalValue,
          },
        });

        if (saleType === "ITEMS") {
          await tx.saleItem.deleteMany({ where: { saleId } });
          await tx.saleItem.createMany({
            data: (data.items ?? []).map((item) => ({
              saleId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: calcItemTotal(item.quantity, item.unitPrice),
            })),
          });
        }

        await tx.installment.updateMany({
          where: { saleId, deletedAt: null },
          data: { deletedAt: new Date() },
        });

        await tx.installment.createMany({
          data: installments.map((inst) => {
            const dueDate = new Date(inst.dueDate + "T12:00:00");
            return {
              saleId,
              number: inst.number,
              value: inst.value,
              dueDate,
              status: getInstallmentStatusForDate(dueDate),
            };
          }),
        });
      });
    } else {
      const expectedUnpaidSum = roundMoney(totalValue - paidSum);
      const inputInstallments = data.installments ?? [];

      if (inputInstallments.length !== unpaidInstallments.length) {
        return {
          error: "A quantidade de parcelas em aberto não pode ser alterada enquanto houver recebimentos",
        };
      }

      const unpaidSum = roundMoney(
        inputInstallments.reduce((s, i) => s + i.value, 0)
      );

      if (Math.abs(unpaidSum - expectedUnpaidSum) >= 0.01) {
        return {
          error: `A soma das parcelas em aberto deve ser ${formatMoneyBr(expectedUnpaidSum)}`,
        };
      }

      const unpaidIds = new Set(unpaidInstallments.map((i) => i.id));
      for (const inst of inputInstallments) {
        if (!inst.id || !unpaidIds.has(inst.id)) {
          return { error: "Parcela inválida" };
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: saleId },
          data: {
            clientId: data.clientId,
            saleDate,
            notes: data.notes || null,
            description: saleType === "DIRECT_VALUE" ? data.description : null,
            totalValue,
          },
        });

        if (saleType === "ITEMS") {
          await tx.saleItem.deleteMany({ where: { saleId } });
          await tx.saleItem.createMany({
            data: (data.items ?? []).map((item) => ({
              saleId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: calcItemTotal(item.quantity, item.unitPrice),
            })),
          });
        }

        for (const inst of inputInstallments) {
          const dueDate = new Date(inst.dueDate + "T12:00:00");
          await tx.installment.update({
            where: { id: inst.id! },
            data: {
              value: inst.value,
              dueDate,
              status: getInstallmentStatusForDate(dueDate),
            },
          });
        }
      });
    }

    revalidatePath("/vendas");
    revalidatePath(`/vendas/${saleId}`);
    revalidatePath("/dashboard");
    revalidatePath("/recebimentos");
    revalidatePath("/clientes");
    if (oldClientId !== data.clientId) {
      revalidatePath(`/clientes/${oldClientId}`);
    }
    revalidatePath(`/clientes/${data.clientId}`);

    return { success: true };
  } catch (error) {
    console.error("updateSale error:", error);
    return { error: "Erro ao atualizar venda. Tente novamente." };
  }
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
