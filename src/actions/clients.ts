"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { clientSchema } from "@/lib/schemas";
import { normalizeCpf, normalizePhone } from "@/lib/validators";

export async function getClients(search?: string) {
  const user = await requireAuth();

  return prisma.client.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { cpf: { contains: search.replace(/\D/g, "") } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      cpf: true,
      sales: {
        where: { deletedAt: null },
        select: {
          installments: {
            where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
            select: { value: true },
          },
        },
      },
    },
  });
}

export async function getClient(id: string) {
  const user = await requireAuth();

  return prisma.client.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      sales: {
        where: { deletedAt: null },
        include: {
          items: true,
          installments: {
            where: { deletedAt: null },
            orderBy: { number: "asc" },
            include: { payment: true },
          },
        },
        orderBy: { saleDate: "desc" },
      },
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
  return { success: true };
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
  return { success: true };
}

export async function deleteClient(id: string) {
  const user = await requireAuth();

  await prisma.client.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/clientes");
  return { success: true };
}
