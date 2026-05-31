"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { categorySchema } from "@/lib/schemas";

export async function getCategories(type?: "INCOME" | "EXPENSE") {
  const user = await requireAuth();

  return prisma.category.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      ...(type ? { type } : {}),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(formData: FormData) {
  const user = await requireAuth();

  const raw = {
    name: formData.get("name") as string,
    type: formData.get("type") as "INCOME" | "EXPENSE",
  };

  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const existing = await prisma.category.findFirst({
    where: {
      userId: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      deletedAt: null,
    },
  });
  if (existing) {
    return { error: "Categoria já existe" };
  }

  await prisma.category.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
    },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/movimentacoes");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const user = await requireAuth();

  await prisma.category.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/movimentacoes");
  return { success: true };
}
