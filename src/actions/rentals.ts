"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  createRentalSchema,
  rentalCostSchema,
  rentalInstallmentPaymentSchema,
  updateRentalSchema,
  type CreateRentalInput,
  type RentalCostInput,
  type UpdateRentalInput,
  type RentalInstallmentPaymentInput,
} from "@/lib/schemas";
import {
  generateRentalInstallments,
  type RentalListStatus,
  type RentalPaymentFrequency,
} from "@/lib/rental-utils";
import { roundMoney } from "@/lib/sale-utils";
import { PAGE_SIZE, parsePage, getTotalPages } from "@/lib/pagination";

function revalidateRentalPaths(rentalId?: string, clientId?: string) {
  revalidatePath("/alugueis");
  revalidatePath("/recebimentos");
  revalidatePath("/dashboard");
  revalidatePath("/movimentacoes");
  revalidatePath("/clientes");
  if (rentalId) revalidatePath(`/alugueis/${rentalId}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

export async function getRentals(
  page?: string | number,
  search?: string,
  statusFilter: RentalListStatus = "ativos"
) {
  const user = await requireAuth();
  const term = search?.trim() ?? "";
  const digits = term.replace(/\D/g, "");

  const where = {
    userId: user.id,
    deletedAt: null,
    ...(statusFilter === "ativos"
      ? { status: "ACTIVE" as const }
      : statusFilter === "finalizados"
        ? { status: { in: ["TRANSFERRED" as const, "RETURNED" as const] } }
        : {}),
    ...(term
      ? {
          OR: [
            { vehicleDescription: { contains: term, mode: "insensitive" as const } },
            { plate: { contains: term, mode: "insensitive" as const } },
            { notes: { contains: term, mode: "insensitive" as const } },
            { client: { name: { contains: term, mode: "insensitive" as const } } },
            ...(digits
              ? [
                  { client: { cpf: { contains: digits } } },
                  { client: { phone: { contains: digits } } },
                ]
              : []),
          ],
        }
      : {}),
  };

  const total = await prisma.rental.count({ where });
  const totalPages = getTotalPages(total);
  const currentPage = Math.min(parsePage(page), totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const items = await prisma.rental.findMany({
    where,
    skip,
    take: PAGE_SIZE,
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      vehicleDescription: true,
      plate: true,
      paymentFrequency: true,
      installmentCount: true,
      installmentValue: true,
      totalValue: true,
      startDate: true,
      paymentDay: true,
      paymentDay2: true,
      weekday: true,
      activeWeekdays: true,
      status: true,
      notes: true,
      vehicleCost: true,
      client: { select: { id: true, name: true } },
      installments: {
        where: { deletedAt: null },
        select: { status: true, value: true },
      },
    },
  });

  return {
    items: items.map((rental) => {
      const paid = rental.installments.filter((i) => i.status === "PAID");
      const open = rental.installments.filter(
        (i) => i.status === "PENDING" || i.status === "OVERDUE"
      );
      return {
        ...rental,
        paidCount: paid.length,
        openCount: open.length,
        paidValue: paid.reduce((s, i) => s + Number(i.value), 0),
        openValue: open.reduce((s, i) => s + Number(i.value), 0),
      };
    }),
    total,
    page: currentPage,
    totalPages,
  };
}

export async function getRental(id: string) {
  const user = await requireAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rental = await prisma.rental.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      client: true,
      installments: {
        where: { deletedAt: null },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!rental) return null;

  // Marca atrasadas
  const overdueIds = rental.installments
    .filter((i) => i.status === "PENDING" && i.dueDate < today)
    .map((i) => i.id);
  if (overdueIds.length > 0) {
    await prisma.rentalInstallment.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "OVERDUE" },
    });
    for (const inst of rental.installments) {
      if (overdueIds.includes(inst.id)) inst.status = "OVERDUE";
    }
  }

  return rental;
}

export async function createRental(input: CreateRentalInput) {
  const user = await requireAuth();
  const parsed = createRentalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  const client = await prisma.client.findFirst({
    where: { id: data.clientId, userId: user.id, deletedAt: null },
  });
  if (!client) return { error: "Cliente não encontrado" };

  const installmentValue = roundMoney(data.installmentValue);
  const installmentCount = data.installmentCount;
  const totalValue = roundMoney(installmentValue * installmentCount);
  const frequency = data.paymentFrequency as RentalPaymentFrequency;

  const installments = generateRentalInstallments({
    frequency,
    installmentValue,
    installmentCount,
    startDate: data.startDate,
    weekday: data.weekday,
    paymentDay: data.paymentDay,
    paymentDay2: data.paymentDay2,
    activeWeekdays: data.activeWeekdays,
  });

  if (installments.length === 0) {
    return { error: "Não foi possível gerar as parcelas com esses parâmetros." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rental = await prisma.rental.create({
    data: {
      userId: user.id,
      clientId: data.clientId,
      vehicleDescription: data.vehicleDescription.trim(),
      plate: data.plate?.trim() || null,
      paymentFrequency: frequency,
      installmentCount,
      installmentValue,
      totalValue,
      vehicleCost:
        data.vehicleCost != null ? roundMoney(data.vehicleCost) : null,
      startDate: new Date(data.startDate + "T12:00:00"),
      paymentDay: data.paymentDay ?? null,
      paymentDay2: data.paymentDay2 ?? null,
      weekday: data.weekday ?? null,
      activeWeekdays:
        frequency === "DAILY" ? [...new Set(data.activeWeekdays ?? [])] : [],
      notes: data.notes?.trim() || null,
      status: "ACTIVE",
      installments: {
        create: installments.map((inst) => {
          const dueDate = new Date(inst.dueDate + "T12:00:00");
          return {
            number: inst.number,
            value: inst.value,
            dueDate,
            status: dueDate < today ? "OVERDUE" : "PENDING",
          };
        }),
      },
    },
  });

  revalidateRentalPaths(rental.id, data.clientId);
  return { success: true, id: rental.id };
}

export async function registerRentalInstallmentPayment(
  input: RentalInstallmentPaymentInput
) {
  const user = await requireAuth();
  const parsed = rentalInstallmentPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { rentalInstallmentId, paymentDate, notes } = parsed.data;
  const installment = await prisma.rentalInstallment.findFirst({
    where: {
      id: rentalInstallmentId,
      deletedAt: null,
      rental: { userId: user.id, deletedAt: null },
    },
    include: {
      rental: { include: { client: true } },
    },
  });

  if (!installment) return { error: "Parcela não encontrada" };
  if (installment.rental.status !== "ACTIVE") {
    return { error: "Só é possível receber parcelas de aluguéis ativos." };
  }
  if (installment.status === "PAID" || installment.status === "CANCELLED") {
    return { error: "Esta parcela já foi paga ou cancelada." };
  }

  const value = Number(installment.value);
  const paidAt = new Date(paymentDate + "T12:00:00");

  await prisma.$transaction(async (tx) => {
    await tx.rentalInstallment.update({
      where: { id: installment.id },
      data: {
        status: "PAID",
        paidAt,
        notes: notes || null,
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "INCOME",
        origin: "RENTAL_PAYMENT",
        description: `Aluguel — ${installment.rental.vehicleDescription} · parcela #${installment.number} — ${installment.rental.client.name}`,
        value,
        date: paidAt,
        notes: notes || null,
        rentalInstallmentId: installment.id,
      },
    });

    const openLeft = await tx.rentalInstallment.count({
      where: {
        rentalId: installment.rentalId,
        deletedAt: null,
        status: { in: ["PENDING", "OVERDUE"] },
        id: { not: installment.id },
      },
    });

    if (openLeft === 0) {
      await tx.rental.update({
        where: { id: installment.rentalId },
        data: {
          status: "TRANSFERRED",
          transferredAt: new Date(),
        },
      });
    }
  });

  revalidateRentalPaths(installment.rentalId, installment.rental.clientId);
  return { success: true };
}

export async function updateRental(id: string, input: UpdateRentalInput) {
  const user = await requireAuth();
  const parsed = updateRentalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }
  const data = parsed.data;

  const rental = await prisma.rental.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { id: true, clientId: true },
  });
  if (!rental) return { error: "Aluguel não encontrado" };

  if (data.clientId !== rental.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id, deletedAt: null },
    });
    if (!client) return { error: "Cliente não encontrado" };
  }

  await prisma.rental.update({
    where: { id },
    data: {
      clientId: data.clientId,
      vehicleDescription: data.vehicleDescription,
      plate: data.plate?.trim() || null,
      vehicleCost:
        data.vehicleCost != null ? roundMoney(data.vehicleCost) : null,
      notes: data.notes?.trim() || null,
    },
  });

  revalidateRentalPaths(id, data.clientId);
  if (data.clientId !== rental.clientId) {
    revalidatePath(`/clientes/${rental.clientId}`);
  }
  return { success: true };
}

export async function updateRentalCost(input: RentalCostInput) {
  const user = await requireAuth();
  const parsed = rentalCostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const rental = await prisma.rental.findFirst({
    where: { id: parsed.data.rentalId, userId: user.id, deletedAt: null },
    select: { id: true, clientId: true },
  });
  if (!rental) return { error: "Aluguel não encontrado" };

  await prisma.rental.update({
    where: { id: rental.id },
    data: {
      vehicleCost:
        parsed.data.vehicleCost != null
          ? roundMoney(parsed.data.vehicleCost)
          : null,
    },
  });

  revalidateRentalPaths(rental.id, rental.clientId);
  return { success: true };
}

export async function markRentalReturned(id: string) {
  const user = await requireAuth();
  const rental = await prisma.rental.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!rental) return { error: "Aluguel não encontrado" };
  if (rental.status !== "ACTIVE") {
    return { error: "Só é possível devolver aluguéis ativos." };
  }

  await prisma.rental.update({
    where: { id },
    data: {
      status: "RETURNED",
      returnedAt: new Date(),
    },
  });

  revalidateRentalPaths(id, rental.clientId);
  return { success: true };
}

export async function deleteRental(id: string) {
  const user = await requireAuth();
  const rental = await prisma.rental.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      installments: {
        where: { deletedAt: null, status: "PAID" },
        select: { id: true },
      },
    },
  });
  if (!rental) return { error: "Aluguel não encontrado" };
  if (rental.installments.length > 0) {
    return {
      error:
        "Não é possível excluir um aluguel com parcelas pagas. Use Devolver se o contrato encerrou.",
    };
  }

  await prisma.$transaction([
    prisma.rentalInstallment.updateMany({
      where: { rentalId: id, deletedAt: null },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    }),
    prisma.rental.update({
      where: { id },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    }),
  ]);

  revalidateRentalPaths(id, rental.clientId);
  return { success: true };
}

export type { RentalListStatus };
