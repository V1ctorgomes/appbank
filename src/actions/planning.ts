"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { isInstallmentFrequency } from "@/lib/loan-utils";
import { roundMoney } from "@/lib/sale-utils";
import { parseMonthFilter } from "@/lib/month-filter";

export type PlanningCategoryKey = "loans" | "rentals" | "sales";

export type PlanningCategory = {
  key: PlanningCategoryKey;
  /** Tudo que entrou no mês nessa categoria. */
  received: number;
  /** Parte do recebido que é lucro (juros / margem). */
  profit: number;
  /** Parte que devolve o capital investido (principal, custo da moto, custo da mercadoria). */
  capital: number;
  /** Recebido de contratos sem custo informado (tratado como capital até informar). */
  unknownCostReceived: number;
  /** Quantos contratos/vendas com recebimento no mês estão sem custo. */
  unknownCostCount: number;
  /** Quanto já foi colocado de volta no negócio no mês (null = sistema não registra). */
  reinvestedThisMonth: number | null;
};

export type PlanningData = {
  monthLabel: string;
  categories: PlanningCategory[];
};

function costRatio(cost: number | null, total: number) {
  if (cost == null || total <= 0) return null;
  return Math.min(Math.max(cost / total, 0), 1);
}

export async function getPlanningData(month?: string): Promise<PlanningData> {
  const user = await requireAuth();
  const userId = user.id;
  const { start, end, label } = parseMonthFilter(month);

  const [loanPayments, loansDisbursed, rentalPaid, rentalsStarted, salePayments] =
    await Promise.all([
      prisma.loanPayment.findMany({
        where: {
          deletedAt: null,
          paymentDate: { gte: start, lte: end },
          loan: { userId, deletedAt: null },
        },
        select: {
          totalValue: true,
          interestValue: true,
          principalValue: true,
          loan: {
            select: { principal: true, totalDue: true, paymentFrequency: true },
          },
        },
      }),
      prisma.loan.aggregate({
        where: { userId, deletedAt: null, loanDate: { gte: start, lte: end } },
        _sum: { principal: true },
      }),
      prisma.rentalInstallment.findMany({
        where: {
          deletedAt: null,
          status: "PAID",
          paidAt: { gte: start, lte: end },
          rental: { userId, deletedAt: null },
        },
        select: {
          value: true,
          rental: { select: { id: true, vehicleCost: true, totalValue: true } },
        },
      }),
      prisma.rental.aggregate({
        where: { userId, deletedAt: null, startDate: { gte: start, lte: end } },
        _sum: { vehicleCost: true },
      }),
      prisma.payment.findMany({
        where: {
          deletedAt: null,
          paymentDate: { gte: start, lte: end },
          installment: { deletedAt: null, sale: { userId, deletedAt: null } },
        },
        select: {
          value: true,
          installment: {
            select: {
              sale: { select: { id: true, costValue: true, totalValue: true } },
            },
          },
        },
      }),
    ]);

  // Empréstimos: juros são lucro; amortização devolve o capital.
  // Nos parcelados o juro está embutido nas parcelas, então separa pela
  // proporção (total devido − principal) / total devido.
  let loanReceived = 0;
  let loanProfit = 0;
  for (const p of loanPayments) {
    const total = Number(p.totalValue);
    loanReceived += total;
    if (isInstallmentFrequency(p.loan.paymentFrequency)) {
      const totalDue = Number(p.loan.totalDue ?? 0);
      const principal = Number(p.loan.principal);
      const ratio = totalDue > principal ? (totalDue - principal) / totalDue : 0;
      loanProfit += total * ratio;
    } else {
      loanProfit += Number(p.interestValue);
    }
  }

  // Aluguéis: cada parcela devolve custo/total da moto; o resto é lucro.
  let rentalReceived = 0;
  let rentalProfit = 0;
  let rentalUnknown = 0;
  const rentalsWithoutCost = new Set<string>();
  for (const inst of rentalPaid) {
    const value = Number(inst.value);
    rentalReceived += value;
    const ratio = costRatio(
      inst.rental.vehicleCost != null ? Number(inst.rental.vehicleCost) : null,
      Number(inst.rental.totalValue)
    );
    if (ratio == null) {
      rentalUnknown += value;
      rentalsWithoutCost.add(inst.rental.id);
    } else {
      rentalProfit += value * (1 - ratio);
    }
  }

  // Vendas: cada recebimento devolve custo/total da mercadoria; o resto é margem.
  let saleReceived = 0;
  let saleProfit = 0;
  let saleUnknown = 0;
  const salesWithoutCost = new Set<string>();
  for (const p of salePayments) {
    const value = Number(p.value);
    const sale = p.installment.sale;
    saleReceived += value;
    const ratio = costRatio(
      sale.costValue != null ? Number(sale.costValue) : null,
      Number(sale.totalValue)
    );
    if (ratio == null) {
      saleUnknown += value;
      salesWithoutCost.add(sale.id);
    } else {
      saleProfit += value * (1 - ratio);
    }
  }

  function build(
    key: PlanningCategoryKey,
    received: number,
    profit: number,
    unknown: number,
    unknownCount: number,
    reinvested: number | null
  ): PlanningCategory {
    const r = roundMoney(received);
    const pr = roundMoney(profit);
    return {
      key,
      received: r,
      profit: pr,
      capital: roundMoney(r - pr),
      unknownCostReceived: roundMoney(unknown),
      unknownCostCount: unknownCount,
      reinvestedThisMonth: reinvested == null ? null : roundMoney(reinvested),
    };
  }

  return {
    monthLabel: label,
    categories: [
      build(
        "loans",
        loanReceived,
        loanProfit,
        0,
        0,
        Number(loansDisbursed._sum.principal ?? 0)
      ),
      build(
        "rentals",
        rentalReceived,
        rentalProfit,
        rentalUnknown,
        rentalsWithoutCost.size,
        Number(rentalsStarted._sum.vehicleCost ?? 0)
      ),
      build(
        "sales",
        saleReceived,
        saleProfit,
        saleUnknown,
        salesWithoutCost.size,
        null
      ),
    ],
  };
}
