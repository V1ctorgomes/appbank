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
import { getRoutineWeeklySummary } from "@/actions/routines";
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

export const chatToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_overview",
      description:
        "Resumo geral do AppBank: saldo, entradas/saídas do mês, vendas, empréstimos ativos, atrasados e metas.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_clients",
      description: "Busca clientes por nome, telefone, CPF ou observação.",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Trecho do nome, telefone ou CPF",
          },
          limit: { type: "number", description: "Máximo de resultados (padrão 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_client_details",
      description:
        "Detalhes de um cliente: contato, vendas, empréstimos e valores em aberto.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string", description: "ID do cliente" },
          clientName: {
            type: "string",
            description: "Nome (ou parte) se não souber o ID",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_loans",
      description: "Lista empréstimos (ativos, quitados ou todos), com opção de busca.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ativos", "quitados", "todos"],
            description: "Filtro de status (padrão ativos)",
          },
          search: { type: "string", description: "Cliente, CPF, telefone ou observação" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_loan_details",
      description:
        "Detalhe de um empréstimo: saldo, juros, parcelas, pagamentos e observação.",
      parameters: {
        type: "object",
        properties: {
          loanId: { type: "string" },
          clientName: {
            type: "string",
            description: "Busca o empréstimo ativo mais recente desse cliente",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_sales",
      description: "Lista vendas recentes, com busca opcional por cliente.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_receivables",
      description:
        "Recebimentos do mês: a receber e já recebidos (vendas e/ou empréstimos).",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            description: "Mês no formato yyyy-MM (padrão mês atual)",
          },
          tipo: {
            type: "string",
            enum: ["todos", "vendas", "emprestimos"],
            description: "Filtro de tipo (padrão todos)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_accounts_receivable",
      description: "Contas a receber agrupadas por cliente (vendas + empréstimos).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_transactions",
      description: "Movimentações (entradas/saídas) recentes.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["INCOME", "EXPENSE", "ALL"],
            description: "Tipo de lançamento",
          },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_goals_and_routine",
      description: "Resumo de metas e rotina/hábitos da semana.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

type ToolArgs = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asLimit(value: unknown, fallback = 20, max = 50) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

async function findClientId(userId: string, args: ToolArgs) {
  const clientId = asString(args.clientId);
  if (clientId) {
    const found = await prisma.client.findFirst({
      where: { id: clientId, userId, deletedAt: null },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  const name = asString(args.clientName);
  if (!name) return null;

  const match = await prisma.client.findFirst({
    where: {
      userId,
      deletedAt: null,
      name: { contains: name, mode: "insensitive" },
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
    return { error: "Argumentos inválidos da ferramenta." };
  }

  switch (name) {
    case "get_overview": {
      const [general, sales, loans, goals] = await Promise.all([
        getDashboardData(),
        getDashboardSaleData(),
        getDashboardLoanData(),
        getGoalsSummary(),
      ]);
      return {
        geral: {
          saldoAtual: money(general.balance),
          entradasMes: money(general.monthIncome),
          saidasMes: money(general.monthExpense),
          aReceberMes: money(general.totalReceivable),
          parcelasAtrasadas: general.overdueCount,
        },
        vendas: {
          aReceberMes: money(sales.monthReceivable),
          atrasadas: sales.overdueCount,
        },
        emprestimos: {
          ativos: loans.activeCount,
          carteiraAberta: money(loans.portfolio),
          recebidoMes: money(loans.monthReceived),
          aReceberMes: money(loans.monthReceivable),
          atrasados: loans.overdueCount,
        },
        metas: goals,
      };
    }

    case "search_clients": {
      const search = asString(args.search);
      const limit = asLimit(args.limit, 20);
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
                    ? [
                        { cpf: { contains: digits } },
                        { phone: { contains: digits } },
                      ]
                    : []),
                ],
              }
            : {}),
        },
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          cpf: true,
          notes: true,
        },
      });
      return {
        total: clients.length,
        clientes: clients.map((c) => ({
          id: c.id,
          nome: c.name,
          telefone: c.phone,
          cpf: c.cpf,
          observacao: c.notes,
        })),
      };
    }

    case "get_client_details": {
      const id = await findClientId(userId, args);
      if (!id) return { error: "Cliente não encontrado." };

      const client = await prisma.client.findFirst({
        where: { id, userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          cpf: true,
          notes: true,
          sales: {
            where: { deletedAt: null },
            orderBy: { saleDate: "desc" },
            take: 15,
            select: {
              id: true,
              saleDate: true,
              totalValue: true,
              type: true,
              installments: {
                where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
                select: { value: true, dueDate: true, status: true, number: true },
              },
            },
          },
          loans: {
            where: { deletedAt: null },
            orderBy: { loanDate: "desc" },
            take: 15,
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
        (sum, sale) =>
          sum + sale.installments.reduce((s, i) => s + Number(i.value), 0),
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
        observacao: client.notes,
        totaisEmAberto: {
          vendas: money(vendasAbertas),
          emprestimos: money(emprestimosAbertos),
          geral: money(vendasAbertas + emprestimosAbertos),
        },
        vendas: client.sales.map((s) => ({
          id: s.id,
          data: dateLabel(s.saleDate),
          total: money(Number(s.totalValue)),
          tipo: s.type,
          parcelasEmAberto: s.installments.map((i) => ({
            numero: i.number,
            valor: money(Number(i.value)),
            vencimento: dateLabel(i.dueDate),
            status: i.status,
          })),
        })),
        emprestimos: client.loans.map((l) => ({
          id: l.id,
          data: dateLabel(l.loanDate),
          principal: money(Number(l.principal)),
          saldo: money(Number(l.remainingBalance)),
          juros: `${Number(l.interestRate)}%`,
          frequencia: loanFrequencyLabel(l.paymentFrequency),
          status: l.status,
          observacao: l.notes,
        })),
      };
    }

    case "list_loans": {
      const status = asString(args.status) || "ativos";
      const search = asString(args.search);
      const limit = asLimit(args.limit, 25);
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
          client: { select: { id: true, name: true } },
        },
      });

      return {
        filtro: status,
        total: loans.length,
        emprestimos: loans.map((loan) => {
          const balance = Number(loan.remainingBalance);
          const rate = Number(loan.interestRate);
          const interestBase = isInstallmentFrequency(loan.paymentFrequency)
            ? Number(loan.principal)
            : balance;
          return {
            id: loan.id,
            cliente: loan.client.name,
            clienteId: loan.client.id,
            data: dateLabel(loan.loanDate),
            principal: money(Number(loan.principal)),
            saldo: money(balance),
            capitalRestante: money(
              remainingLoanCapital({
                principal: loan.principal,
                remainingBalance: loan.remainingBalance,
                totalDue: loan.totalDue,
              })
            ),
            jurosMes: `${rate}% (${money(calcMonthlyInterest(interestBase, rate))})`,
            frequencia: loanFrequencyLabel(loan.paymentFrequency),
            status: loan.status,
            observacao: loan.notes,
          };
        }),
      };
    }

    case "get_loan_details": {
      let loanId = asString(args.loanId);
      if (!loanId) {
        const clientName = asString(args.clientName);
        if (clientName) {
          const found = await prisma.loan.findFirst({
            where: {
              userId,
              deletedAt: null,
              status: "ACTIVE",
              client: { name: { contains: clientName, mode: "insensitive" } },
            },
            orderBy: { loanDate: "desc" },
            select: { id: true },
          });
          loanId = found?.id ?? "";
        }
      }
      if (!loanId) return { error: "Empréstimo não encontrado." };

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, userId, deletedAt: null },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          installments: {
            where: { deletedAt: null },
            orderBy: { number: "asc" },
          },
          payments: {
            where: { deletedAt: null },
            orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
            take: 30,
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
        jurosDoMes: money(calcMonthlyInterest(balance, rate)),
        frequencia: loanFrequencyLabel(loan.paymentFrequency),
        status: loan.status,
        observacao: loan.notes,
        totalCiclo: loan.totalDue != null ? money(Number(loan.totalDue)) : null,
        parcelas: loan.installments.map((i) => ({
          numero: i.number,
          valor: money(Number(i.value)),
          vencimento: dateLabel(i.dueDate),
          status: i.status,
          pagoEm: dateLabel(i.paidAt),
        })),
        pagamentos: loan.payments.map((p) => ({
          data: dateLabel(p.paymentDate),
          tipo: p.type,
          valor: money(Number(p.totalValue)),
          juros: money(Number(p.interestValue)),
          amortizacao: money(Number(p.principalValue)),
          observacao: p.notes,
        })),
      };
    }

    case "list_sales": {
      const search = asString(args.search);
      const limit = asLimit(args.limit, 20);
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
          type: true,
          description: true,
          client: { select: { name: true } },
          installments: {
            where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
            select: { value: true },
          },
        },
      });

      return {
        total: sales.length,
        vendas: sales.map((s) => ({
          id: s.id,
          cliente: s.client.name,
          data: dateLabel(s.saleDate),
          total: money(Number(s.totalValue)),
          tipo: s.type,
          descricao: s.description,
          emAberto: money(
            s.installments.reduce((sum, i) => sum + Number(i.value), 0)
          ),
        })),
      };
    }

    case "get_receivables": {
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
        tipo,
        aReceber: {
          quantidade: pending.items.length,
          total: money(pending.totalValue),
          itens: pending.items.slice(0, 40).map((i) => ({
            tipo: i.kind,
            cliente: i.clientName,
            referencia: i.label,
            valor: money(i.value),
            vencimento: dateLabel(i.dueDate),
            status: i.status,
            observacao: i.notes ?? null,
          })),
        },
        recebidos: {
          quantidade: history.items.length,
          total: money(history.totalValue),
          itens: history.items.slice(0, 40).map((i) => ({
            tipo: i.kind,
            cliente: i.clientName,
            referencia: i.label,
            valor: money(i.value),
            data: dateLabel(i.paymentDate),
            observacao: i.notes,
          })),
        },
      };
    }

    case "get_accounts_receivable": {
      const items = await getAccountsReceivable();
      return {
        totalClientes: items.length,
        totalGeral: money(items.reduce((sum, i) => sum + i.pendingValue, 0)),
        clientes: items.slice(0, 40).map((i) => ({
          cliente: i.clientName,
          total: money(i.pendingValue),
          vendas: money(i.salesPending),
          emprestimos: money(i.loansPending),
          itensPendentes: i.pendingCount,
          proximoVencimento: dateLabel(i.nextDue),
        })),
      };
    }

    case "list_transactions": {
      const type = asString(args.type) || "ALL";
      const limit = asLimit(args.limit, 25);
      const txs = await prisma.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
        },
        take: limit,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          date: true,
          type: true,
          origin: true,
          description: true,
          value: true,
          notes: true,
        },
      });
      return {
        total: txs.length,
        movimentacoes: txs.map((t) => ({
          data: dateLabel(t.date),
          tipo: t.type === "INCOME" ? "Entrada" : "Saída",
          origem: t.origin,
          descricao: t.description,
          valor: money(Number(t.value)),
          observacao: t.notes,
        })),
      };
    }

    case "get_goals_and_routine": {
      const [goals, routine] = await Promise.all([
        getGoalsSummary(),
        getRoutineWeeklySummary(),
      ]);
      return { metas: goals, rotina: routine };
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
