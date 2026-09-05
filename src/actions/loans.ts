"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  createLoanSchema,
  updateLoanSchema,
  loanPaymentSchema,
  loanInstallmentPaymentSchema,
  type CreateLoanInput,
  type UpdateLoanInput,
  type LoanPaymentInput,
  type LoanInstallmentPaymentInput,
} from "@/lib/schemas";
import {
  allocateInstallmentSettlement,
  allocateLoanPayment,
  calcLoanTotalDue,
  calcMonthlyInterest,
  generateLoanInstallments,
  isInstallmentFrequency,
  LOAN_INSTALLMENT_COUNTS,
  monthInputFromDate,
  monthInputToDate,
} from "@/lib/loan-utils";
import { roundMoney } from "@/lib/sale-utils";
import { PAGE_SIZE, parsePage, getTotalPages } from "@/lib/pagination";

function revalidateLoanPaths(loanId?: string, clientId?: string) {
  revalidatePath("/emprestimos");
  revalidatePath("/recebimentos");
  revalidatePath("/dashboard");
  revalidatePath("/movimentacoes");
  revalidatePath("/clientes");
  if (loanId) revalidatePath(`/emprestimos/${loanId}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

function resolveBillingFields(data: CreateLoanInput | UpdateLoanInput) {
  const frequency = data.paymentFrequency ?? "MONTHLY";

  if (frequency === "MONTHLY") {
    const billingStartMonth = data.billingStartMonth!;
    const paymentDay = data.paymentDay!;
    return {
      paymentFrequency: "MONTHLY" as const,
      paymentDay,
      paymentDay2: null as number | null,
      weekday: null as number | null,
      billingStartMonth: monthInputToDate(billingStartMonth),
      billingStartDate: null as Date | null,
      totalDue: null as number | null,
      installmentCount: null as number | null,
      installments: [] as { number: number; value: number; dueDate: string }[],
    };
  }

  const billingStartDateStr = data.billingStartDate!;
  const billingStartDate = new Date(billingStartDateStr + "T12:00:00");
  const billingStartMonth = monthInputToDate(monthInputFromDate(billingStartDate));
  const totalDue = calcLoanTotalDue(roundMoney(data.principal), data.interestRate);
  const installmentCount = LOAN_INSTALLMENT_COUNTS[frequency];

  if (frequency === "WEEKLY") {
    const weekday = data.weekday!;
    const installments = generateLoanInstallments({
      frequency: "WEEKLY",
      totalDue,
      billingStartDate: billingStartDateStr,
      weekday,
    });
    return {
      paymentFrequency: "WEEKLY" as const,
      paymentDay: weekday === 0 ? 7 : weekday,
      paymentDay2: null as number | null,
      weekday,
      billingStartMonth,
      billingStartDate,
      totalDue,
      installmentCount,
      installments,
    };
  }

  if (frequency === "DAILY") {
    const day = Number(billingStartDateStr.slice(8, 10)) || 1;
    const installments = generateLoanInstallments({
      frequency: "DAILY",
      totalDue,
      billingStartDate: billingStartDateStr,
    });
    return {
      paymentFrequency: "DAILY" as const,
      paymentDay: day,
      paymentDay2: null as number | null,
      weekday: null as number | null,
      billingStartMonth,
      billingStartDate,
      totalDue,
      installmentCount,
      installments,
    };
  }

  const paymentDay = data.paymentDay!;
  const paymentDay2 = data.paymentDay2!;
  const installments = generateLoanInstallments({
    frequency: "BIWEEKLY",
    totalDue,
    billingStartDate: billingStartDateStr,
    paymentDay,
    paymentDay2,
  });

  return {
    paymentFrequency: "BIWEEKLY" as const,
    paymentDay,
    paymentDay2,
    weekday: null as number | null,
    billingStartMonth,
    billingStartDate,
    totalDue,
    installmentCount,
    installments,
  };
}

export async function getLoans(page?: string | number) {
  const user = await requireAuth();

  const where = { userId: user.id, deletedAt: null };

  const total = await prisma.loan.count({ where });
  const totalPages = getTotalPages(total);
  const currentPage = Math.min(parsePage(page), totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const items = await prisma.loan.findMany({
    where,
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      principal: true,
      remainingBalance: true,
      interestRate: true,
      paymentFrequency: true,
      paymentDay: true,
      paymentDay2: true,
      weekday: true,
      billingStartMonth: true,
      billingStartDate: true,
      totalDue: true,
      installmentCount: true,
      loanDate: true,
      status: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { loanDate: "desc" },
  });

  return {
    items,
    total,
    page: currentPage,
    totalPages: getTotalPages(total),
  };
}

export async function getLoan(id: string) {
  const user = await requireAuth();

  return prisma.loan.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      client: true,
      payments: {
        where: { deletedAt: null },
        orderBy: { paymentDate: "desc" },
      },
      installments: {
        where: { deletedAt: null },
        orderBy: { number: "asc" },
      },
    },
  });
}

export async function createLoan(input: CreateLoanInput) {
  const user = await requireAuth();

  const parsed = createLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  const amount = roundMoney(data.principal);
  const resolved = resolveBillingFields(data);

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, userId: user.id, deletedAt: null },
  });

  if (!client) {
    return { error: "Cliente não encontrado" };
  }

  const remainingBalance = resolved.totalDue ?? amount;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const loan = await prisma.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        userId: user.id,
        clientId: data.clientId,
        principal: amount,
        remainingBalance,
        interestRate: data.interestRate,
        paymentFrequency: resolved.paymentFrequency,
        paymentDay: resolved.paymentDay,
        paymentDay2: resolved.paymentDay2,
        weekday: resolved.weekday,
        billingStartMonth: resolved.billingStartMonth,
        billingStartDate: resolved.billingStartDate,
        totalDue: resolved.totalDue,
        installmentCount: resolved.installmentCount,
        loanDate: new Date(data.loanDate + "T12:00:00"),
        notes: data.notes || null,
        status: "ACTIVE",
        installments:
          resolved.installments.length > 0
            ? {
                create: resolved.installments.map((inst) => {
                  const dueDate = new Date(inst.dueDate + "T12:00:00");
                  return {
                    number: inst.number,
                    value: inst.value,
                    dueDate,
                    status: dueDate < today ? "OVERDUE" : "PENDING",
                  };
                }),
              }
            : undefined,
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "EXPENSE",
        origin: "LOAN_DISBURSEMENT",
        description: `Empréstimo liberado — ${client.name}`,
        value: amount,
        date: new Date(data.loanDate + "T12:00:00"),
        notes: data.notes || null,
      },
    });

    return created;
  });

  revalidateLoanPaths(loan.id, data.clientId);

  return { success: true, id: loan.id };
}

export async function updateLoan(id: string, input: UpdateLoanInput) {
  const user = await requireAuth();

  const parsed = updateLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const loan = await prisma.loan.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      client: true,
      payments: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  if (!loan) {
    return { error: "Empréstimo não encontrado" };
  }

  if (loan.payments.length > 0) {
    return {
      error: "Não é possível editar um empréstimo que já possui pagamentos.",
    };
  }

  if (loan.status !== "ACTIVE") {
    return { error: "Só é possível editar empréstimos ativos." };
  }

  const data = parsed.data;
  const amount = roundMoney(data.principal);
  const resolved = resolveBillingFields(data);

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, userId: user.id, deletedAt: null },
  });

  if (!client) {
    return { error: "Cliente não encontrado" };
  }

  const remainingBalance = resolved.totalDue ?? amount;
  const oldPrincipal = Number(loan.principal);
  const oldDate = loan.loanDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$transaction(async (tx) => {
    await tx.loanInstallment.deleteMany({ where: { loanId: id } });

    await tx.loan.update({
      where: { id },
      data: {
        clientId: data.clientId,
        principal: amount,
        remainingBalance,
        interestRate: data.interestRate,
        paymentFrequency: resolved.paymentFrequency,
        paymentDay: resolved.paymentDay,
        paymentDay2: resolved.paymentDay2,
        weekday: resolved.weekday,
        billingStartMonth: resolved.billingStartMonth,
        billingStartDate: resolved.billingStartDate,
        totalDue: resolved.totalDue,
        installmentCount: resolved.installmentCount,
        loanDate: new Date(data.loanDate + "T12:00:00"),
        notes: data.notes || null,
        installments:
          resolved.installments.length > 0
            ? {
                create: resolved.installments.map((inst) => {
                  const dueDate = new Date(inst.dueDate + "T12:00:00");
                  return {
                    number: inst.number,
                    value: inst.value,
                    dueDate,
                    status: dueDate < today ? "OVERDUE" : "PENDING",
                  };
                }),
              }
            : undefined,
      },
    });

    const disbursement = await tx.transaction.findFirst({
      where: {
        userId: user.id,
        origin: "LOAN_DISBURSEMENT",
        deletedAt: null,
        value: oldPrincipal,
        date: oldDate,
        description: { startsWith: "Empréstimo liberado" },
      },
      orderBy: { createdAt: "desc" },
    });

    if (disbursement) {
      await tx.transaction.update({
        where: { id: disbursement.id },
        data: {
          description: `Empréstimo liberado — ${client.name}`,
          value: amount,
          date: new Date(data.loanDate + "T12:00:00"),
          notes: data.notes || null,
        },
      });
    } else {
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "EXPENSE",
          origin: "LOAN_DISBURSEMENT",
          description: `Empréstimo liberado — ${client.name}`,
          value: amount,
          date: new Date(data.loanDate + "T12:00:00"),
          notes: data.notes || null,
        },
      });
    }
  });

  revalidateLoanPaths(id, data.clientId);
  if (data.clientId !== loan.clientId) {
    revalidatePath(`/clientes/${loan.clientId}`);
  }

  return { success: true };
}

export async function registerLoanPayment(input: LoanPaymentInput) {
  const user = await requireAuth();

  const parsed = loanPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { loanId, paymentDate, value, notes, settle } = parsed.data;

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId: user.id, deletedAt: null },
    include: {
      client: true,
      installments: {
        where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
      },
    },
  });

  if (!loan) {
    return { error: "Empréstimo não encontrado" };
  }

  if (loan.status !== "ACTIVE") {
    return { error: "Este empréstimo não está ativo" };
  }

  const isInstallment = isInstallmentFrequency(loan.paymentFrequency);

  let finalAllocation;

  if (isInstallment) {
    if (!settle) {
      return {
        error:
          "Para empréstimos parcelados, use o recebimento da parcela ou a quitação total.",
      };
    }
    const allocation = allocateInstallmentSettlement(Number(loan.remainingBalance));
    if ("error" in allocation) return { error: allocation.error };
    finalAllocation = allocation;
  } else {
    const interestDue = calcMonthlyInterest(
      Number(loan.remainingBalance),
      Number(loan.interestRate)
    );
    const paidAmount = settle
      ? roundMoney(Number(loan.remainingBalance) + interestDue)
      : value;
    const allocation = allocateLoanPayment(
      Number(loan.remainingBalance),
      Number(loan.interestRate),
      paidAmount
    );
    if ("error" in allocation) return { error: allocation.error };
    finalAllocation = allocation;
  }

  const typeLabel =
    finalAllocation.type === "INTEREST_ONLY"
      ? "juros"
      : finalAllocation.type === "FULL_SETTLEMENT"
        ? "quitação"
        : "juros + amortização";

  const description = `Empréstimo (${typeLabel}) — ${loan.client.name}`;
  const paidAt = new Date(paymentDate + "T12:00:00");

  await prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.create({
      data: {
        loanId,
        paymentDate: paidAt,
        type: finalAllocation.type,
        totalValue: finalAllocation.totalValue,
        interestValue: finalAllocation.interestValue,
        principalValue: finalAllocation.principalValue,
        balanceBefore: finalAllocation.balanceBefore,
        balanceAfter: finalAllocation.balanceAfter,
        interestRate: Number(loan.interestRate),
        notes: notes || null,
      },
    });

    await tx.loan.update({
      where: { id: loanId },
      data: {
        remainingBalance: finalAllocation.balanceAfter,
        status: finalAllocation.type === "FULL_SETTLEMENT" ? "SETTLED" : "ACTIVE",
        settledAt: finalAllocation.type === "FULL_SETTLEMENT" ? paidAt : null,
      },
    });

    if (isInstallment && finalAllocation.type === "FULL_SETTLEMENT") {
      await tx.loanInstallment.updateMany({
        where: {
          loanId,
          deletedAt: null,
          status: { in: ["PENDING", "OVERDUE"] },
        },
        data: {
          status: "PAID",
          paidAt,
          loanPaymentId: payment.id,
        },
      });
    }

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "INCOME",
        origin: "LOAN_PAYMENT",
        description,
        value: finalAllocation.totalValue,
        date: paidAt,
        notes: notes || null,
        loanPaymentId: payment.id,
      },
    });
  });

  revalidateLoanPaths(loanId, loan.clientId);

  return { success: true, allocation: finalAllocation };
}

export async function registerLoanInstallmentPayment(
  input: LoanInstallmentPaymentInput
) {
  const user = await requireAuth();

  const parsed = loanInstallmentPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { loanInstallmentId, paymentDate, value, notes } = parsed.data;

  const installment = await prisma.loanInstallment.findFirst({
    where: {
      id: loanInstallmentId,
      deletedAt: null,
      loan: { userId: user.id, deletedAt: null },
    },
    include: {
      loan: { include: { client: true } },
    },
  });

  if (!installment) {
    return { error: "Parcela não encontrada" };
  }

  if (installment.loan.status !== "ACTIVE") {
    return { error: "Este empréstimo não está ativo" };
  }

  if (installment.status === "PAID" || installment.status === "CANCELLED") {
    return { error: "Esta parcela já foi paga ou cancelada" };
  }

  const paid = roundMoney(value);
  const installmentValue = roundMoney(Number(installment.value));
  if (Math.abs(paid - installmentValue) > 0.009) {
    return {
      error: `O valor deve ser exatamente ${installmentValue.toFixed(2)} (use Quitação para liquidar o restante).`,
    };
  }

  const balanceBefore = roundMoney(Number(installment.loan.remainingBalance));
  const balanceAfter = roundMoney(Math.max(0, balanceBefore - paid));
  const isLast = balanceAfter <= 0.009;
  const paidAt = new Date(paymentDate + "T12:00:00");

  await prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.create({
      data: {
        loanId: installment.loanId,
        paymentDate: paidAt,
        type: isLast ? "FULL_SETTLEMENT" : "INSTALLMENT",
        totalValue: paid,
        interestValue: 0,
        principalValue: paid,
        balanceBefore,
        balanceAfter: isLast ? 0 : balanceAfter,
        interestRate: Number(installment.loan.interestRate),
        notes: notes || null,
      },
    });

    await tx.loanInstallment.update({
      where: { id: installment.id },
      data: {
        status: "PAID",
        paidAt,
        loanPaymentId: payment.id,
      },
    });

    if (isLast) {
      await tx.loanInstallment.updateMany({
        where: {
          loanId: installment.loanId,
          deletedAt: null,
          status: { in: ["PENDING", "OVERDUE"] },
          id: { not: installment.id },
        },
        data: {
          status: "PAID",
          paidAt,
          loanPaymentId: payment.id,
        },
      });
    }

    await tx.loan.update({
      where: { id: installment.loanId },
      data: {
        remainingBalance: isLast ? 0 : balanceAfter,
        status: isLast ? "SETTLED" : "ACTIVE",
        settledAt: isLast ? paidAt : null,
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "INCOME",
        origin: "LOAN_PAYMENT",
        description: isLast
          ? `Empréstimo (quitação) — ${installment.loan.client.name}`
          : `Empréstimo (parcela #${installment.number}) — ${installment.loan.client.name}`,
        value: paid,
        date: paidAt,
        notes: notes || null,
        loanPaymentId: payment.id,
      },
    });
  });

  revalidateLoanPaths(installment.loanId, installment.loan.clientId);

  return { success: true };
}

export async function cancelLoanPayment(paymentId: string) {
  const user = await requireAuth();

  const payment = await prisma.loanPayment.findFirst({
    where: {
      id: paymentId,
      deletedAt: null,
      loan: { userId: user.id, deletedAt: null },
    },
    include: {
      loan: true,
      installments: { where: { deletedAt: null } },
    },
  });

  if (!payment) {
    return { error: "Pagamento não encontrado" };
  }

  const laterPayment = await prisma.loanPayment.findFirst({
    where: {
      loanId: payment.loanId,
      deletedAt: null,
      createdAt: { gt: payment.createdAt },
    },
    orderBy: { createdAt: "asc" },
  });

  if (laterPayment) {
    return {
      error:
        "Só é possível estornar o último pagamento. Estorne os posteriores primeiro.",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$transaction(async (tx) => {
    await tx.loanPayment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date() },
    });

    if (payment.installments.length > 0) {
      for (const inst of payment.installments) {
        const due = new Date(inst.dueDate);
        due.setHours(0, 0, 0, 0);
        await tx.loanInstallment.update({
          where: { id: inst.id },
          data: {
            status: due < today ? "OVERDUE" : "PENDING",
            paidAt: null,
            loanPaymentId: null,
          },
        });
      }
    }

    await tx.loan.update({
      where: { id: payment.loanId },
      data: {
        remainingBalance: payment.balanceBefore,
        status: "ACTIVE",
        settledAt: null,
      },
    });

    await tx.transaction.updateMany({
      where: {
        loanPaymentId: paymentId,
        userId: user.id,
        origin: "LOAN_PAYMENT",
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  });

  revalidateLoanPaths(payment.loanId, payment.loan.clientId);

  return { success: true };
}

export async function deleteLoan(id: string) {
  const user = await requireAuth();

  const loan = await prisma.loan.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      payments: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  if (!loan) {
    return { error: "Empréstimo não encontrado" };
  }

  if (loan.payments.length > 0) {
    return {
      error:
        "Não é possível excluir um empréstimo com pagamentos. Estorne os pagamentos antes.",
    };
  }

  await prisma.$transaction([
    prisma.loanInstallment.updateMany({
      where: { loanId: id, deletedAt: null },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    }),
    prisma.loan.update({
      where: { id },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    }),
  ]);

  revalidatePath("/emprestimos");
  revalidatePath("/dashboard");
  revalidatePath("/clientes");

  return { success: true };
}
