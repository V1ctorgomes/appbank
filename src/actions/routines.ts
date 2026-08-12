"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { routineSchema, adHocLogSchema, type RoutineInput, type AdHocLogInput } from "@/lib/schemas";

const db = prisma as any;

const toDateKey = (d: Date | string) => {
  if (typeof d === "string") return d.split("T")[0];
  const dateObj = new Date(d);
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export async function getRoutinesForDate(dateStr?: string) {
  try {
    const user = await requireAuth();
    const targetDateStr = dateStr || toDateKey(new Date());

    const [year, month, day] = targetDateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dayOfWeek = dateObj.getUTCDay().toString();

    // 1. Busca todas as rotinas ativas do usuário
    const allRoutines = await db.routine.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      orderBy: [{ startTime: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });

    // Filtra rotinas ativas para o dia da semana
    const routinesForDay = allRoutines.filter((r: any) => {
      if (!r.daysOfWeek) return true;
      const days = r.daysOfWeek.split(",").map((d: string) => d.trim());
      return days.includes(dayOfWeek);
    });

    // 2. Busca logs existentes para a data especificada
    const logs = await db.routineLog.findMany({
      where: {
        userId: user.id,
        date: targetDateStr,
      },
    });

    const logsMap = new Map<string, any>();
    const adHocLogs: any[] = [];

    logs.forEach((log: any) => {
      if (log.routineId) {
        logsMap.set(log.routineId, log);
      } else if (log.isAdHoc) {
        adHocLogs.push(log);
      }
    });

    // Combina rotinas com seus respectivos logs
    const items = routinesForDay.map((routine: any) => {
      const log = logsMap.get(routine.id);
      return {
        id: routine.id,
        routineId: routine.id,
        title: routine.title,
        description: routine.description,
        icon: routine.icon,
        type: routine.type,
        period: routine.period,
        startTime: routine.startTime,
        endTime: routine.endTime,
        isAdHoc: false,
        status: log ? log.status : "PENDING",
        logId: log ? log.id : null,
        notes: log ? log.notes : null,
      };
    });

    // Adiciona logs ad-hoc (imprevistos) do dia
    adHocLogs.forEach((log: any) => {
      items.push({
        id: log.id,
        routineId: null,
        title: log.title || "Imprevisto registrado",
        description: null,
        icon: "⚡",
        type: "ACTIVITY",
        period: "ANYTIME",
        startTime: log.startTime,
        endTime: log.endTime,
        isAdHoc: true,
        status: log.status,
        logId: log.id,
        notes: log.notes,
      });
    });

    // Ordenação final por horário de início
    items.sort((a: any, b: any) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });

    const total = items.length;
    const completed = items.filter((i: any) => i.status === "COMPLETED").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      dateStr: targetDateStr,
      items,
      summary: {
        total,
        completed,
        percentage,
      },
    };
  } catch (err) {
    console.error("Erro em getRoutinesForDate:", err);
    return {
      dateStr: dateStr || toDateKey(new Date()),
      items: [],
      summary: { total: 0, completed: 0, percentage: 0 },
    };
  }
}

export async function createRoutine(input: RoutineInput) {
  const user = await requireAuth();
  const data = routineSchema.parse(input);

  const routine = await db.routine.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description,
      icon: data.icon || "📌",
      type: data.type,
      period: data.period,
      daysOfWeek: data.daysOfWeek,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      order: data.order,
    },
  });

  revalidatePath("/rotina");
  revalidatePath("/dashboard");
  return { success: true, routine };
}

export async function updateRoutine(id: string, input: RoutineInput) {
  const user = await requireAuth();
  const data = routineSchema.parse(input);

  const existing = await db.routine.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!existing) {
    return { error: "Rotina não encontrada" };
  }

  const routine = await db.routine.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      icon: data.icon || "📌",
      type: data.type,
      period: data.period,
      daysOfWeek: data.daysOfWeek,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      order: data.order,
    },
  });

  revalidatePath("/rotina");
  revalidatePath("/dashboard");
  return { success: true, routine };
}

export async function deleteRoutine(id: string) {
  const user = await requireAuth();

  const existing = await db.routine.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!existing) {
    return { error: "Rotina não encontrada" };
  }

  await db.routine.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/rotina");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleRoutineLog(
  routineId: string,
  dateStr: string,
  targetStatus?: string,
  notes?: string
) {
  const user = await requireAuth();

  const existingLog = await db.routineLog.findFirst({
    where: {
      routineId,
      userId: user.id,
      date: dateStr,
    },
  });

  let nextStatus = targetStatus;

  if (!nextStatus) {
    if (!existingLog || existingLog.status !== "COMPLETED") {
      nextStatus = "COMPLETED";
    } else {
      nextStatus = "FAILED";
    }
  }

  if (existingLog) {
    await db.routineLog.update({
      where: { id: existingLog.id },
      data: {
        status: nextStatus,
        notes: notes !== undefined ? notes : existingLog.notes,
      },
    });
  } else {
    await db.routineLog.create({
      data: {
        userId: user.id,
        routineId,
        date: dateStr,
        status: nextStatus,
        notes: notes || null,
      },
    });
  }

  revalidatePath("/rotina");
  revalidatePath("/dashboard");
  return { success: true, status: nextStatus };
}

export async function createAdHocRoutineLog(input: AdHocLogInput) {
  const user = await requireAuth();
  const data = adHocLogSchema.parse(input);

  const log = await db.routineLog.create({
    data: {
      userId: user.id,
      routineId: null,
      date: data.date,
      title: data.title,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      status: "UNEXPECTED_EVENT",
      notes: data.notes || null,
      isAdHoc: true,
    },
  });

  revalidatePath("/rotina");
  revalidatePath("/dashboard");
  return { success: true, log };
}

export async function deleteRoutineLog(logId: string) {
  const user = await requireAuth();

  const existing = await db.routineLog.findFirst({
    where: { id: logId, userId: user.id },
  });

  if (!existing) {
    return { error: "Registro não encontrado" };
  }

  await db.routineLog.delete({
    where: { id: logId },
  });

  revalidatePath("/rotina");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getRoutineWeeklySummary() {
  try {
    const user = await requireAuth();
    const today = new Date();
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = toDateKey(d);

      const [year, month, dayNum] = dateStr.split("-").map(Number);
      const dateObj = new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0));
      const dayOfWeek = dateObj.getUTCDay().toString();
      const weekdaysShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      const routines = await db.routine.findMany({
        where: { userId: user.id, deletedAt: null },
      });

      const routinesForDay = routines.filter((r: any) => {
        if (!r.daysOfWeek) return true;
        return r.daysOfWeek.split(",").map((s: string) => s.trim()).includes(dayOfWeek);
      });

      const logs = await db.routineLog.findMany({
        where: { userId: user.id, date: dateStr },
      });

      const completed = logs.filter((l: any) => l.status === "COMPLETED").length;
      const total = routinesForDay.length + logs.filter((l: any) => l.isAdHoc).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      days.push({
        dateStr,
        weekday: weekdaysShort[dateObj.getUTCDay()],
        dayNum: dateObj.getUTCDate(),
        completed,
        total,
        percentage: pct,
      });
    }

    return days;
  } catch (err) {
    console.error("Erro em getRoutineWeeklySummary:", err);
    return [];
  }
}
