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

  // Busca todas as despesas recentes para cálculo por dias da semana
  const expenseTransactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: "EXPENSE",
      deletedAt: null,
    },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  const expenseDateStrings = new Set(
    expenseTransactions.map((t) => new Date(t.date).toISOString().split("T")[0])
  );

  const toDateKey = (d: Date | string) => {
    if (typeof d === "string") return d.split("T")[0];
    const dateObj = new Date(d);
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayKey = toDateKey(new Date());

  const processedGoals = goals.map((goal) => {
    let currentCount = goal.currentCount ?? 0;
    let currentAmount = Number(goal.currentAmount ?? 0);
    let targetCount = goal.targetCount ?? 0;
    let targetAmount = Number(goal.targetAmount ?? 0);
    let targetDays = goal.targetDays ?? 0;
    let isAutoCompleted = goal.isCompleted;

    const startDateKey = goal.startDate ? toDateKey(goal.startDate) : null;
    const hasNotStarted = startDateKey ? startDateKey > todayKey : false;

    if (hasNotStarted) {
      currentCount = 0;
      currentAmount = 0;
      isAutoCompleted = false;
    } else if (goal.type === "LOAN_COUNT") {
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
      const allowedDays =
        goal.selectedDays && goal.selectedDays.trim()
          ? goal.selectedDays.split(",").map((d) => parseInt(d.trim(), 10))
          : [0, 1, 2, 3, 4, 5, 6];

      let streak = 0;
      let checkDate = new Date();

      for (let i = 0; i < 90; i++) {
        const checkKey = toDateKey(checkDate);
        if (startDateKey && checkKey < startDateKey) {
          break; // Interrompe ao alcançar dias anteriores ao início da meta
        }

        const dayOfWeek = checkDate.getDay();

        if (allowedDays.includes(dayOfWeek)) {
          if (expenseDateStrings.has(checkKey)) {
            // Se registrou despesa num dia ativo, quebra o streak
            break;
          } else {
            streak++;
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }

      currentCount = streak;
      if (targetDays > 0 && currentCount >= targetDays) {
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
    selectedDays,
    startDate,
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
      selectedDays: selectedDays || null,
      startDate: startDate ? new Date(startDate + "T12:00:00Z") : new Date(),
      targetDate: targetDate ? new Date(targetDate + "T12:00:00Z") : null,
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
    selectedDays,
    startDate,
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
      selectedDays: selectedDays || null,
      startDate: startDate ? new Date(startDate + "T12:00:00Z") : null,
      targetDate: targetDate ? new Date(targetDate + "T12:00:00Z") : null,
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


