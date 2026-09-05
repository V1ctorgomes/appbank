import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function syncOverdueInstallments(userId: string) {
  const today = startOfDay(new Date());
  await prisma.installment.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: today },
      deletedAt: null,
      sale: { userId, deletedAt: null },
    },
    data: { status: "OVERDUE" },
  });

  await prisma.loanInstallment.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: today },
      deletedAt: null,
      loan: { userId, deletedAt: null, status: "ACTIVE" },
    },
    data: { status: "OVERDUE" },
  });
}
