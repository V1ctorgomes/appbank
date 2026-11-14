import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import {
  getDashboardData,
  getDashboardLoanData,
  getDashboardSaleData,
} from "@/actions/dashboard";
import { getPendingRecebimentos, getHistoryRecebimentos } from "@/actions/recebimentos";
import { getAccountsReceivable } from "@/actions/reports";
import { getGoalsSummary } from "@/actions/goals";
import {
  calcMonthlyInterest,
  isInstallmentFrequency,
  loanFrequencyLabel,
  remainingLoanCapital,
} from "@/lib/loan-utils";
import { formatCurrency } from "@/lib/utils";

function money(value: number) {
  return formatCurrency(value);
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

function monthKey(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
  return format(new Date(), "yyyy-MM");
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asLimit(value: unknown, fallback = 15, max = 25) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

type ToolArgs = Record<string, unknown>;

/** Poucas tools = bem menos tokens por request na Groq. */
export const chatToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "query_app",
      description:
        "Consulta dados do AppBank. Use resource: overview, clients, client, loans, loan, sales, receivables, debts, transactions, goals.",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: [
              "overview",
              "clients",
              "client",
              "loans",
              "loan",
              "sales",
              "receivables",
              "debts",
              "transactions",
              "goals",
            ],
          },
          search: { type: "string", description: "Nome, CPF, telefone ou observação" },
          id: { type: "string", description: "ID do cliente ou empréstimo" },
          status: {
            type: "string",
            enum: ["ativos", "quitados", "todos"],
          },
          month: { type: "string", description: "yyyy-MM" },
          tipo: {
            type: "string",
            enum: ["todos", "vendas", "emprestimos"],
          },
          limit: { type: "number" },
        },
        required: ["resource"],
        additionalProperties: false,
      },
    },
  },
];

export async function buildChatSnapshot(userId: string) {
  const month = monthKey();
  const [general, sales, loans, pending] = await Promise.all([
    getDashboardData(),
    getDashboardSaleData(),
    getDashboardLoanData(),
    getPendingRecebimentos(month, "todos"),
  ]);

  const topPending = pending.items.slice(0, 8).map((i) => ({
    cliente: i.clientName,
    ref: i.label,
    valor: money(i.value),
    venc: dateLabel(i.dueDate),
    status: i.status,
    obs: i.notes ?? undefined,
  }));

  return {
    mes: month,
    saldo: money(general.balance),
    entradasMes: money(general.monthIncome),
    saidasMes: money(general.monthExpense),
    aReceberMes: money(general.totalReceivable),
    atrasadosVendas: general.overdueCount,
    emprestimosAtivos: loans.activeCount,
    carteira: money(loans.portfolio),
    recebidoEmprestimosMes: money(loans.monthReceived),
    aReceberEmprestimosMes: money(loans.monthReceivable),
    atrasadosEmprestimos: loans.overdueCount,
    aReceberVendasMes: money(sales.monthReceivable),
    pendenciasMesQtd: pending.items.length,
    pendenciasMesTotal: money(pending.totalValue),
    topPendencias: topPending,
    userIdHint: userId.slice(0, 6),
  };
}

async function findClientId(userId: string, args: ToolArgs) {
  const id = asString(args.id);
  if (id) {
    const found = await prisma.client.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true },
    });
    if (found) return found.id;
  }

  const search = asString(args.search);
  if (!search) return null;
  const match = await prisma.client.findFirst({
    where: {
      userId,
      deletedAt: null,
      name: { contains: search, mode: "insensitive" },
    },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return match?.id ?? null;
}

export async function executeChatTool(
  userId: string,
  name: string,
  rawArgs: string
): Promise<unknown> {
  let args: ToolArgs = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as ToolArgs) : {};
  } catch {
    return { error: "Argumentos inválidos." };
  }

  if (name !== "query_app") {
    return { error: `Ferramenta desconhecida: ${name}` };
  }

  const resource = asString(args.resource);
  const search = asString(args.search);
  const limit = asLimit(args.limit);

  switch (resource) {
    case "overview":
      return buildChatSnapshot(userId);

    case "clients": {
      const digits = search.replace(/\D/g, "");
      const clients = await prisma.client.findMany({
        where: {
          userId,
          deletedAt: null,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { notes: { contains: search, mode: "insensitive" } },
                  ...(digits
                    ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }]
                    : []),
                ],
              }
            : {}),
        },
        take: limit,
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true, cpf: true, notes: true },
      });
      return {
        clientes: clients.map((c) => ({
          id: c.id,
          nome: c.name,
          telefone: c.phone,
          cpf: c.cpf,
          obs: c.notes,
        })),
      };
    }

    case "client": {
      const clientId = await findClientId(userId, args);
      if (!clientId) return { error: "Cliente não encontrado." };
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          cpf: true,
          notes: true,
          sales: {
            where: { deletedAt: null },
            orderBy: { saleDate: "desc" },
            take: 10,
            select: {
              id: true,
              saleDate: true,
              totalValue: true,
              installments: {
                where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
                select: { number: true, value: true, dueDate: true, status: true },
              },
            },
          },
          loans: {
            where: { deletedAt: null },
            orderBy: { loanDate: "desc" },
            take: 10,
            select: {
              id: true,
              loanDate: true,
              principal: true,
              remainingBalance: true,
              interestRate: true,
              paymentFrequency: true,
              status: true,
              notes: true,
            },
          },
        },
      });
      if (!client) return { error: "Cliente não encontrado." };

      const vendasAbertas = client.sales.reduce(
        (sum, s) => sum + s.installments.reduce((a, i) => a + Number(i.value), 0),
        0
      );
      const emprestimosAbertos = client.loans
        .filter((l) => l.status === "ACTIVE")
        .reduce((sum, l) => sum + Number(l.remainingBalance), 0);

      return {
        id: client.id,
        nome: client.name,
        telefone: client.phone,
        cpf: client.cpf,
        obs: client.notes,
        aberto: {
          vendas: money(vendasAbertas),
          emprestimos: money(emprestimosAbertos),
          total: money(vendasAbertas + emprestimosAbertos),
        },
        vendas: client.sales.map((s) => ({
          id: s.id,
          data: dateLabel(s.saleDate),
          total: money(Number(s.totalValue)),
          parcelasAbertas: s.installments.map((i) => ({
            n: i.number,
            valor: money(Number(i.value)),
            venc: dateLabel(i.dueDate),
            status: i.status,
          })),
        })),
        emprestimos: client.loans.map((l) => ({
          id: l.id,
          data: dateLabel(l.loanDate),
          principal: money(Number(l.principal)),
          saldo: money(Number(l.remainingBalance)),
          juros: `${Number(l.interestRate)}%`,
          freq: loanFrequencyLabel(l.paymentFrequency),
          status: l.status,
          obs: l.notes,
        })),
      };
    }

    case "loans": {
      const status = asString(args.status) || "ativos";
      const digits = search.replace(/\D/g, "");
      const loans = await prisma.loan.findMany({
        where: {
          userId,
          deletedAt: null,
          ...(status === "ativos"
            ? { status: "ACTIVE" }
            : status === "quitados"
              ? { status: "SETTLED" }
              : {}),
          ...(search
            ? {
                OR: [
                  { notes: { contains: search, mode: "insensitive" } },
                  { client: { name: { contains: search, mode: "insensitive" } } },
                  ...(digits
                    ? [
                        { client: { cpf: { contains: digits } } },
                        { client: { phone: { contains: digits } } },
                      ]
                    : []),
                ],
              }
            : {}),
        },
        take: limit,
        orderBy: { loanDate: "desc" },
        select: {
          id: true,
          loanDate: true,
          principal: true,
          remainingBalance: true,
          totalDue: true,
          interestRate: true,
          paymentFrequency: true,
          status: true,
          notes: true,
          client: { select: { name: true } },
        },
      });

      return {
        emprestimos: loans.map((loan) => {
          const balance = Number(loan.remainingBalance);
          const rate = Number(loan.interestRate);
          const base = isInstallmentFrequency(loan.paymentFrequency)
            ? Number(loan.principal)
            : balance;
          return {
            id: loan.id,
            cliente: loan.client.name,
            data: dateLabel(loan.loanDate),
            principal: money(Number(loan.principal)),
            saldo: money(balance),
            capital: money(
              remainingLoanCapital({
                principal: loan.principal,
                remainingBalance: loan.remainingBalance,
                totalDue: loan.totalDue,
              })
            ),
            jurosMes: money(calcMonthlyInterest(base, rate)),
            freq: loanFrequencyLabel(loan.paymentFrequency),
            status: loan.status,
            obs: loan.notes,
          };
        }),
      };
    }

    case "loan": {
      let loanId = asString(args.id);
      if (!loanId && search) {
        const found = await prisma.loan.findFirst({
          where: {
            userId,
            deletedAt: null,
            status: "ACTIVE",
            client: { name: { contains: search, mode: "insensitive" } },
          },
          orderBy: { loanDate: "desc" },
          select: { id: true },
        });
        loanId = found?.id ?? "";
      }
      if (!loanId) return { error: "Empréstimo não encontrado." };

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, userId, deletedAt: null },
        include: {
          client: { select: { name: true, phone: true } },
          installments: {
            where: { deletedAt: null },
            orderBy: { number: "asc" },
            take: 40,
          },
          payments: {
            where: { deletedAt: null },
            orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
            take: 15,
          },
        },
      });
      if (!loan) return { error: "Empréstimo não encontrado." };

      const balance = Number(loan.remainingBalance);
      const rate = Number(loan.interestRate);
      return {
        id: loan.id,
        cliente: loan.client.name,
        telefone: loan.client.phone,
        data: dateLabel(loan.loanDate),
        principal: money(Number(loan.principal)),
        saldo: money(balance),
        juros: `${rate}%`,
        jurosMes: money(calcMonthlyInterest(balance, rate)),
        freq: loanFrequencyLabel(loan.paymentFrequency),
        status: loan.status,
        obs: loan.notes,
        parcelas: loan.installments.map((i) => ({
          n: i.number,
          valor: money(Number(i.value)),
          venc: dateLabel(i.dueDate),
          status: i.status,
        })),
        pagamentos: loan.payments.map((p) => ({
          data: dateLabel(p.paymentDate),
          tipo: p.type,
          valor: money(Number(p.totalValue)),
          obs: p.notes,
        })),
      };
    }

    case "sales": {
      const sales = await prisma.sale.findMany({
        where: {
          userId,
          deletedAt: null,
          ...(search
            ? {
                OR: [
                  { description: { contains: search, mode: "insensitive" } },
                  { client: { name: { contains: search, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        take: limit,
        orderBy: { saleDate: "desc" },
        select: {
          id: true,
          saleDate: true,
          totalValue: true,
          description: true,
          client: { select: { name: true } },
          installments: {
            where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
            select: { value: true },
          },
        },
      });
      return {
        vendas: sales.map((s) => ({
          id: s.id,
          cliente: s.client.name,
          data: dateLabel(s.saleDate),
          total: money(Number(s.totalValue)),
          aberto: money(s.installments.reduce((a, i) => a + Number(i.value), 0)),
          desc: s.description,
        })),
      };
    }

    case "receivables": {
      const month = monthKey(asString(args.month) || undefined);
      const tipoRaw = asString(args.tipo) || "todos";
      const tipo =
        tipoRaw === "vendas" || tipoRaw === "emprestimos" ? tipoRaw : "todos";
      const [pending, history] = await Promise.all([
        getPendingRecebimentos(month, tipo),
        getHistoryRecebimentos(month, tipo),
      ]);
      return {
        mes: month,
        aReceberTotal: money(pending.totalValue),
        aReceber: pending.items.slice(0, 20).map((i) => ({
          cliente: i.clientName,
          ref: i.label,
          valor: money(i.value),
          venc: dateLabel(i.dueDate),
          status: i.status,
          obs: i.notes ?? undefined,
        })),
        recebidosTotal: money(history.totalValue),
        recebidos: history.items.slice(0, 15).map((i) => ({
          cliente: i.clientName,
          ref: i.label,
          valor: money(i.value),
          data: dateLabel(i.paymentDate),
          obs: i.notes ?? undefined,
        })),
      };
    }

    case "debts": {
      const items = await getAccountsReceivable();
      return {
        total: money(items.reduce((s, i) => s + i.pendingValue, 0)),
        clientes: items.slice(0, 20).map((i) => ({
          cliente: i.clientName,
          total: money(i.pendingValue),
          vendas: money(i.salesPending),
          emprestimos: money(i.loansPending),
          proxVenc: dateLabel(i.nextDue),
        })),
      };
    }

    case "transactions": {
      const txs = await prisma.transaction.findMany({
        where: { userId, deletedAt: null },
        take: limit,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: {
          date: true,
          type: true,
          description: true,
          value: true,
          notes: true,
        },
      });
      return {
        movimentacoes: txs.map((t) => ({
          data: dateLabel(t.date),
          tipo: t.type === "INCOME" ? "Entrada" : "Saída",
          desc: t.description,
          valor: money(Number(t.value)),
          obs: t.notes,
        })),
      };
    }

    case "goals": {
      const goals = await getGoalsSummary();
      return {
        total: goals.total,
        concluidas: goals.completed,
        emAndamento: goals.inProgress,
        progressoMedio: `${goals.averageProgress}%`,
        recentes: goals.recentGoals.slice(0, 5).map((g) => ({
          titulo: g.title,
          tipo: g.type,
          concluida: g.isCompleted,
        })),
      };
    }

    default:
      return { error: `resource inválido: ${resource}` };
  }
}
