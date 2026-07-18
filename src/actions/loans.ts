"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  createLoanSchema,
  updateLoanSchema,
  loanPaymentSchema,
  type CreateLoanInput,
  type UpdateLoanInput,
  type LoanPaymentInput,
} from "@/lib/schemas";
import { allocateLoanPayment, monthInputToDate } from "@/lib/loan-utils";
import { roundMoney } from "@/lib/sale-utils";
import { PAGE_SIZE, parsePage, getTotalPages } from "@/lib/pagination";

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
      paymentDay: true,
      billingStartMonth: true,
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
    },
  });
}

export async function createLoan(input: CreateLoanInput) {
  const user = await requireAuth();

  const parsed = createLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { clientId, principal, interestRate, paymentDay, billingStartMonth, loanDate, notes } =
    parsed.data;
  const amount = roundMoney(principal);

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id, deletedAt: null },
  });

  if (!client) {
    return { error: "Cliente não encontrado" };
  }

  const loan = await prisma.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        userId: user.id,
        clientId,
        principal: amount,
        remainingBalance: amount,
        interestRate,
        paymentDay,
        billingStartMonth: monthInputToDate(billingStartMonth),
        loanDate: new Date(loanDate + "T12:00:00"),
        notes: notes || null,
        status: "ACTIVE",
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "EXPENSE",
        origin: "LOAN_DISBURSEMENT",
        description: `Empréstimo liberado — ${client.name}`,
        value: amount,
        date: new Date(loanDate + "T12:00:00"),
        notes: notes || null,
      },
    });

    return created;
  });

  revalidatePath("/emprestimos");
  revalidatePath("/dashboard");
  revalidatePath("/movimentacoes");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);

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

  const { clientId, principal, interestRate, paymentDay, billingStartMonth, loanDate, notes } =
    parsed.data;
  const amount = roundMoney(principal);

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id, deletedAt: null },
  });

  if (!client) {
    return { error: "Cliente não encontrado" };
  }

  const oldPrincipal = Number(loan.principal);
  const oldDate = loan.loanDate;

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id },
      data: {
        clientId,
        principal: amount,
        remainingBalance: amount,
        interestRate,
        paymentDay,
        billingStartMonth: monthInputToDate(billingStartMonth),
        loanDate: new Date(loanDate + "T12:00:00"),
        notes: notes || null,
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
          date: new Date(loanDate + "T12:00:00"),
          notes: notes || null,
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
          date: new Date(loanDate + "T12:00:00"),
          notes: notes || null,
        },
      });
    }
  });

  revalidatePath("/emprestimos");
  revalidatePath(`/emprestimos/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/movimentacoes");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  if (clientId !== loan.clientId) {
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

  const { loanId, paymentDate, value, notes } = parsed.data;

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId: user.id, deletedAt: null },
    include: { client: true },
  });

  if (!loan) {
    return { error: "Empréstimo não encontrado" };
  }

  if (loan.status !== "ACTIVE") {
    return { error: "Este empréstimo não está ativo" };
  }

  const allocation = allocateLoanPayment(
    Number(loan.remainingBalance),
    Number(loan.interestRate),
    value
  );

  if ("error" in allocation) {
    return { error: allocation.error };
  }

  const typeLabel =
    allocation.type === "INTEREST_ONLY"
      ? "juros"
      : allocation.type === "FULL_SETTLEMENT"
        ? "quitação"
        : "juros + amortização";

  const description = `Empréstimo (${typeLabel}) — ${loan.client.name}`;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.create({
      data: {
        loanId,
        paymentDate: new Date(paymentDate + "T12:00:00"),
        type: allocation.type,
        totalValue: allocation.totalValue,
        interestValue: allocation.interestValue,
        principalValue: allocation.principalValue,
        balanceBefore: allocation.balanceBefore,
        balanceAfter: allocation.balanceAfter,
        interestRate: Number(loan.interestRate),
        notes: notes || null,
      },
    });

    await tx.loan.update({
      where: { id: loanId },
      data: {
        remainingBalance: allocation.balanceAfter,
        status: allocation.type === "FULL_SETTLEMENT" ? "SETTLED" : "ACTIVE",
        settledAt:
          allocation.type === "FULL_SETTLEMENT"
            ? new Date(paymentDate + "T12:00:00")
            : null,
      },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "INCOME",
        origin: "LOAN_PAYMENT",
        description,
        value: allocation.totalValue,
        date: new Date(paymentDate + "T12:00:00"),
        notes: notes || null,
        loanPaymentId: payment.id,
      },
    });
  });

  revalidatePath("/emprestimos");
  revalidatePath(`/emprestimos/${loanId}`);
  revalidatePath("/recebimentos");
  revalidatePath("/dashboard");
  revalidatePath("/movimentacoes");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${loan.clientId}`);

  return { success: true, allocation };
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

  await prisma.$transaction(async (tx) => {
    await tx.loanPayment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date() },
    });

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

  revalidatePath("/emprestimos");
  revalidatePath(`/emprestimos/${payment.loanId}`);
  revalidatePath("/recebimentos");
  revalidatePath("/dashboard");
  revalidatePath("/movimentacoes");
  revalidatePath("/clientes");

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

  await prisma.loan.update({
    where: { id },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  });

  revalidatePath("/emprestimos");
  revalidatePath("/dashboard");
  revalidatePath("/clientes");

  return { success: true };
}
