"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { goalSchema, type GoalInput } from "@/lib/schemas";
import { GoalType } from "@prisma/client";

export async function getGoals(filterType?: string) {
  const user = await requireAuth();

  const where: any = {
    userId: user.id,
    deletedAt: null,
  };

  if (filterType && filterType !== "ALL") {
    if (filterType === "COMPLETED") {
      where.isCompleted = true;
    } else if (filterType === "ACTIVE") {
      where.isCompleted = false;
    } else {
      where.type = filterType as GoalType;
    }
  }

  const goals = await prisma.goal.findMany({
    where,
    orderBy: [{ isCompleted: "asc" }, { targetDate: "asc" }, { createdAt: "desc" }],
  });

  // Cálculo dinâmico de dados em tempo real (Empréstimos, Streaks, etc.)
  const [activeLoansCount, activeLoansSum, latestExpense] = await Promise.all([
    prisma.loan.count({
      where: {
        userId: user.id,
        status: "ACTIVE",
        deletedAt: null,
      },
    }),
    prisma.loan.aggregate({
      where: {
        userId: user.id,
        status: "ACTIVE",
        deletedAt: null,
      },
      _sum: {
        remainingBalance: true,
      },
    }),
    prisma.transaction.findFirst({
      where: {
        userId: user.id,
        type: "EXPENSE",
        deletedAt: null,
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const totalLoansBalance = Number(activeLoansSum._sum.remainingBalance ?? 0);

  // Calcula streak de dias sem gastar
  let daysWithoutExpense = 0;
  if (latestExpense) {
    const lastDate = new Date(latestExpense.date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    daysWithoutExpense = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } else {
    // Se nunca teve despesa registrada
    daysWithoutExpense = 30;
  }

  const processedGoals = goals.map((goal) => {
    let currentCount = goal.currentCount ?? 0;
    let currentAmount = Number(goal.currentAmount ?? 0);
    let targetCount = goal.targetCount ?? 0;
    let targetAmount = Number(goal.targetAmount ?? 0);
    let targetDays = goal.targetDays ?? 0;
    let isAutoCompleted = goal.isCompleted;

    if (goal.type === "LOAN_COUNT") {
      currentCount = activeLoansCount;
      if (targetCount > 0 && currentCount >= targetCount) {
        isAutoCompleted = true;
      }
    } else if (goal.type === "LOAN_PORTFOLIO") {
      currentAmount = totalLoansBalance;
      if (targetAmount > 0 && currentAmount >= targetAmount) {
        isAutoCompleted = true;
      }
    } else if (goal.type === "EXPENSE_STREAK") {
      currentCount = daysWithoutExpense;
      if (targetDays > 0 && daysWithoutExpense >= targetDays) {
        isAutoCompleted = true;
      }
    }

    return {
      ...goal,
      targetAmount,
      currentAmount,
      currentCount,
      isCompleted: isAutoCompleted,
    };
  });

  return processedGoals;
}

export async function createGoal(input: GoalInput) {
  const user = await requireAuth();

  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const {
    title,
    description,
    type,
    targetAmount,
    currentAmount,
    targetCount,
    currentCount,
    targetDays,
    targetDate,
  } = parsed.data;

  await prisma.goal.create({
    data: {
      userId: user.id,
      title,
      description: description || null,
      type: type as GoalType,
      targetAmount: targetAmount !== undefined ? targetAmount : null,
      currentAmount: currentAmount !== undefined ? currentAmount : null,
      targetCount: targetCount !== undefined ? targetCount : null,
      currentCount: currentCount !== undefined ? currentCount : null,
      targetDays: targetDays !== undefined ? targetDays : null,
      targetDate: targetDate ? new Date(targetDate + "T12:00:00") : null,
    },
  });

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateGoal(id: string, input: GoalInput) {
  const user = await requireAuth();

  const existing = await prisma.goal.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!existing) {
    return { error: "Meta não encontrada" };
  }

  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const {
    title,
    description,
    type,
    targetAmount,
    currentAmount,
    targetCount,
    currentCount,
    targetDays,
    targetDate,
  } = parsed.data;

  await prisma.goal.update({
    where: { id },
    data: {
      title,
      description: description || null,
      type: type as GoalType,
      targetAmount: targetAmount !== undefined ? targetAmount : null,
      currentAmount: currentAmount !== undefined ? currentAmount : null,
      targetCount: targetCount !== undefined ? targetCount : null,
      currentCount: currentCount !== undefined ? currentCount : null,
      targetDays: targetDays !== undefined ? targetDays : null,
      targetDate: targetDate ? new Date(targetDate + "T12:00:00") : null,
    },
  });

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleGoalCompletion(id: string) {
  const user = await requireAuth();

  const existing = await prisma.goal.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!existing) {
    return { error: "Meta não encontrada" };
  }

  const nextState = !existing.isCompleted;

  await prisma.goal.update({
    where: { id },
    data: {
      isCompleted: nextState,
      completedAt: nextState ? new Date() : null,
    },
  });

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteGoal(id: string) {
  const user = await requireAuth();

  const existing = await prisma.goal.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!existing) {
    return { error: "Meta não encontrada" };
  }

  await prisma.goal.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getGoalsSummary() {
  const user = await requireAuth();

  const goals = await getGoals("ALL");

  const total = goals.length;
  const completed = goals.filter((g) => g.isCompleted).length;
  const inProgress = total - completed;

  let totalPercentSum = 0;
  goals.forEach((g) => {
    if (g.isCompleted) {
      totalPercentSum += 100;
    } else {
      let pct = 0;
      if (g.type === "LOAN_COUNT" && g.targetCount) {
        pct = Math.min(100, Math.round(((g.currentCount ?? 0) / g.targetCount) * 100));
      } else if (g.type === "LOAN_PORTFOLIO" && g.targetAmount) {
        pct = Math.min(100, Math.round(((g.currentAmount ?? 0) / g.targetAmount) * 100));
      } else if (g.type === "EXPENSE_STREAK" && g.targetDays) {
        pct = Math.min(100, Math.round(((g.currentCount ?? 0) / g.targetDays) * 100));
      } else if (g.type === "SAVINGS_TARGET" && g.targetAmount) {
        pct = Math.min(100, Math.round(((g.currentAmount ?? 0) / g.targetAmount) * 100));
      }
      totalPercentSum += pct;
    }
  });

  const averageProgress = total > 0 ? Math.round(totalPercentSum / total) : 0;

  return {
    total,
    completed,
    inProgress,
    averageProgress,
    recentGoals: goals.slice(0, 4),
  };
}
