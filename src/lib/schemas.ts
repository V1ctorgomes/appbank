import { z } from "zod";
import { validateCpf, validatePhone } from "./validators";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .refine(validatePhone, "Telefone inválido (informe DDD)"),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .refine(validateCpf, "CPF inválido"),
  notes: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().min(1, "Descrição é obrigatória"),
  categoryId: z.string().optional(),
  value: z.coerce.number().positive("Valor deve ser maior que zero"),
  date: z.string().min(1, "Data é obrigatória"),
  notes: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;

const saleItemSchema = z.object({
  name: z.string().min(1, "Nome do item é obrigatório"),
  quantity: z.coerce.number().int().positive("Quantidade deve ser maior que zero"),
  unitPrice: z.coerce.number().positive("Valor unitário deve ser maior que zero"),
});

const installmentSchema = z.object({
  number: z.coerce.number().int().positive(),
  value: z.coerce.number().positive("Valor da parcela deve ser maior que zero"),
  dueDate: z.string().min(1, "Data de vencimento é obrigatória"),
});

export const createSaleSchema = z
  .object({
    clientId: z.string().min(1, "Cliente é obrigatório"),
    type: z.enum(["ITEMS", "DIRECT_VALUE"]),
    saleDate: z.string().min(1, "Data da venda é obrigatória"),
    notes: z.string().optional(),
    description: z.string().optional(),
    directValue: z.coerce.number().optional(),
    items: z.array(saleItemSchema).optional(),
    paymentType: z.enum(["CASH", "INSTALLMENT"]),
    installmentMode: z.enum(["AUTO", "MANUAL"]).optional(),
    installmentCount: z.coerce.number().int().positive().optional(),
    firstDueDate: z.string().optional(),
    installments: z.array(installmentSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "DIRECT_VALUE") {
      if (!data.description?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Descrição é obrigatória",
          path: ["description"],
        });
      }
      if (!data.directValue || data.directValue <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valor total deve ser maior que zero",
          path: ["directValue"],
        });
      }
    }

    if (data.type === "ITEMS") {
      if (!data.items?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Adicione pelo menos um item",
          path: ["items"],
        });
      }
    }

    if (data.paymentType === "INSTALLMENT") {
      if (data.installmentMode === "AUTO") {
        if (!data.installmentCount || data.installmentCount < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe a quantidade de parcelas",
            path: ["installmentCount"],
          });
        }
        if (!data.firstDueDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe o primeiro vencimento",
            path: ["firstDueDate"],
          });
        }
      }
      if (data.installmentMode === "MANUAL") {
        if (!data.installments?.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Adicione pelo menos uma parcela",
            path: ["installments"],
          });
        }
      }
    }
  });

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type InstallmentFormInput = z.infer<typeof installmentSchema>;

const updateInstallmentSchema = installmentSchema.extend({
  id: z.string().optional(),
});

export const updateSaleSchema = z
  .object({
    clientId: z.string().min(1, "Cliente é obrigatório"),
    saleDate: z.string().min(1, "Data da venda é obrigatória"),
    notes: z.string().optional(),
    description: z.string().optional(),
    directValue: z.coerce.number().optional(),
    items: z.array(saleItemSchema).optional(),
    paymentType: z.enum(["CASH", "INSTALLMENT"]).optional(),
    installmentMode: z.enum(["AUTO", "MANUAL"]).optional(),
    installmentCount: z.coerce.number().int().positive().optional(),
    firstDueDate: z.string().optional(),
    installments: z.array(updateInstallmentSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentType === "INSTALLMENT" && data.installmentMode === "AUTO") {
      if (!data.installmentCount || data.installmentCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a quantidade de parcelas",
          path: ["installmentCount"],
        });
      }
      if (!data.firstDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o primeiro vencimento",
          path: ["firstDueDate"],
        });
      }
    }
    if (data.paymentType === "INSTALLMENT" && data.installmentMode === "MANUAL") {
      if (!data.installments?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Adicione pelo menos uma parcela",
          path: ["installments"],
        });
      }
    }
  });

export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;

export const paymentSchema = z.object({
  installmentId: z.string().min(1, "Parcela é obrigatória"),
  paymentDate: z.string().min(1, "Data do pagamento é obrigatória"),
  value: z.coerce.number().positive("Valor recebido deve ser maior que zero"),
  notes: z.string().optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const createLoanSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  principal: z.coerce.number().positive("Valor do empréstimo deve ser maior que zero"),
  interestRate: z.coerce
    .number()
    .min(0, "Juros não pode ser negativo")
    .max(100, "Juros mensal máximo é 100%"),
  paymentDay: z.coerce
    .number()
    .int("Dia do pagamento deve ser um número inteiro")
    .min(1, "Dia do pagamento deve ser entre 1 e 31")
    .max(31, "Dia do pagamento deve ser entre 1 e 31"),
  billingStartMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Informe o mês de início da cobrança"),
  loanDate: z.string().min(1, "Data do empréstimo é obrigatória"),
  notes: z.string().optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;

export const updateLoanSchema = createLoanSchema;

export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;

export const loanPaymentSchema = z.object({
  loanId: z.string().min(1, "Empréstimo é obrigatório"),
  paymentDate: z.string().min(1, "Data do pagamento é obrigatória"),
  value: z.coerce.number().positive("Valor pago deve ser maior que zero"),
  notes: z.string().optional(),
});

export type LoanPaymentInput = z.infer<typeof loanPaymentSchema>;

export const goalSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  type: z.enum([
    "LOAN_COUNT",
    "LOAN_PORTFOLIO",
    "LOAN_MONTHLY_GROWTH",
    "SAVINGS_TARGET",
    "EXPENSE_STREAK",
    "MANUAL_CHECKLIST",
  ]),
  targetAmount: z.coerce.number().positive().optional(),
  currentAmount: z.coerce.number().min(0).optional(),
  targetCount: z.coerce.number().int().positive().optional(),
  currentCount: z.coerce.number().int().min(0).optional(),
  targetDays: z.coerce.number().int().positive().optional(),
  selectedDays: z.string().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;

