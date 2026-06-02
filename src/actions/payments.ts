"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { parseMonthFilter } from "@/lib/month-filter";
import { paymentSchema, type PaymentInput } from "@/lib/schemas";

async function syncOverdueInstallments(userId: string) {
  const today = startOfDay(new Date());
  await prisma.installment.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: today },
      deletedAt: null,
      sale: { userId },
    },
    data: { status: "OVERDUE" },
  });
}

export async function getPendingInstallments(month?: string) {
  const user = await requireAuth();
  await syncOverdueInstallments(user.id);

  const { start, end } = parseMonthFilter(month);

  const items = await prisma.installment.findMany({
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

  const totalValue = items.reduce((sum, i) => sum + Number(i.value), 0);

  return { items, totalValue };
}

export async function getPaymentHistory(month?: string) {
  const user = await requireAuth();
  const { start, end } = parseMonthFilter(month);

  const items = await prisma.payment.findMany({
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

  const totalValue = items.reduce((sum, p) => sum + Number(p.value), 0);

  return { items, totalValue };
}

export async function getInstallment(installmentId: string) {
  const user = await requireAuth();

  return prisma.installment.findFirst({
    where: {
      id: installmentId,
      deletedAt: null,
      sale: { userId: user.id, deletedAt: null },
    },
    include: {
      sale: {
        include: { client: true },
      },
    },
  });
}

export async function registerPayment(input: PaymentInput) {
  const user = await requireAuth();

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { installmentId, paymentDate, value, notes } = parsed.data;

  const installment = await prisma.installment.findFirst({
    where: {
      id: installmentId,
      deletedAt: null,
      sale: { userId: user.id, deletedAt: null },
    },
    include: {
      payment: true,
      sale: {
        include: { client: true },
      },
    },
  });

  if (!installment) {
    return { error: "Parcela não encontrada" };
  }

  if (installment.status === "PAID" || installment.payment) {
    return { error: "Esta parcela já foi paga" };
  }

  if (installment.status === "CANCELLED") {
    return { error: "Esta parcela está cancelada" };
  }

  const clientName = installment.sale.client.name;
  const description = `Recebimento - ${clientName} - Parcela ${installment.number}`;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        installmentId,
        paymentDate: new Date(paymentDate + "T12:00:00"),
        value,
        notes: notes || null,
      },
    });

    await tx.installment.update({
      where: { id: installmentId },
      data: {
        status: "PAID",
        paidAt: new Date(paymentDate + "T12:00:00"),
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "INCOME",
        origin: "INSTALLMENT_PAYMENT",
        description,
        value,
        date: new Date(paymentDate + "T12:00:00"),
        notes: notes || null,
        installmentId,
      },
    });
  });

  revalidatePath("/recebimentos");
  revalidatePath("/vendas");
  revalidatePath(`/vendas/${installment.saleId}`);
  revalidatePath("/dashboard");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${installment.sale.clientId}`);
  revalidatePath("/movimentacoes");

  return { success: true };
}

export async function cancelPayment(installmentId: string) {
  const user = await requireAuth();

  const installment = await prisma.installment.findFirst({
    where: {
      id: installmentId,
      deletedAt: null,
      status: "PAID",
      sale: { userId: user.id, deletedAt: null },
    },
    include: { payment: true },
  });

  if (!installment?.payment) {
    return { error: "Pagamento não encontrado" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = installment.dueDate < today;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: installment.payment!.id },
      data: { deletedAt: new Date() },
    });

    await tx.installment.update({
      where: { id: installmentId },
      data: {
        status: isOverdue ? "OVERDUE" : "PENDING",
        paidAt: null,
      },
    });

    await tx.transaction.updateMany({
      where: {
        installmentId,
        userId: user.id,
        origin: "INSTALLMENT_PAYMENT",
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  });

  revalidatePath("/recebimentos");
  revalidatePath("/vendas");
  revalidatePath(`/vendas/${installment.saleId}`);
  revalidatePath("/dashboard");
  revalidatePath("/clientes");
  revalidatePath("/movimentacoes");

  return { success: true };
}
