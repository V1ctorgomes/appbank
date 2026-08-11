-- Garante tabelas do módulo de empréstimos (idempotente)

DO $$ BEGIN
  CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'SETTLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoanPaymentType" AS ENUM ('INTEREST_ONLY', 'INTEREST_AND_PARTIAL', 'FULL_SETTLEMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionOrigin" ADD VALUE IF NOT EXISTS 'LOAN_DISBURSEMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionOrigin" ADD VALUE IF NOT EXISTS 'LOAN_PAYMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Loan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "principal" DECIMAL(12,2) NOT NULL,
  "remainingBalance" DECIMAL(12,2) NOT NULL,
  "interestRate" DECIMAL(7,2) NOT NULL,
  "paymentDay" INTEGER NOT NULL DEFAULT 1,
  "billingStartMonth" DATE NOT NULL DEFAULT CURRENT_DATE,
  "loanDate" DATE NOT NULL,
  "notes" TEXT,
  "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
  "settledAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "paymentDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "billingStartMonth" DATE;
UPDATE "Loan"
SET "billingStartMonth" = DATE_TRUNC('month', "loanDate")::date
WHERE "billingStartMonth" IS NULL;
ALTER TABLE "Loan" ALTER COLUMN "billingStartMonth" SET DEFAULT CURRENT_DATE;
DO $$ BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "billingStartMonth" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LoanPayment" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "paymentDate" DATE NOT NULL,
  "type" "LoanPaymentType" NOT NULL,
  "totalValue" DECIMAL(12,2) NOT NULL,
  "interestValue" DECIMAL(12,2) NOT NULL,
  "principalValue" DECIMAL(12,2) NOT NULL,
  "balanceBefore" DECIMAL(12,2) NOT NULL,
  "balanceAfter" DECIMAL(12,2) NOT NULL,
  "interestRate" DECIMAL(7,2) NOT NULL,
  "notes" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "loanPaymentId" TEXT;

CREATE INDEX IF NOT EXISTS "Loan_userId_deletedAt_idx" ON "Loan"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Loan_clientId_idx" ON "Loan"("clientId");
CREATE INDEX IF NOT EXISTS "Loan_status_idx" ON "Loan"("status");
CREATE INDEX IF NOT EXISTS "LoanPayment_loanId_idx" ON "LoanPayment"("loanId");
CREATE INDEX IF NOT EXISTS "LoanPayment_paymentDate_idx" ON "LoanPayment"("paymentDate");

DO $$ BEGIN
  ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Loan" ADD CONSTRAINT "Loan_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_loanPaymentId_fkey"
    FOREIGN KEY ("loanPaymentId") REFERENCES "LoanPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Garante tabela do módulo de Metas (idempotente)
DO $$ BEGIN
  CREATE TYPE "GoalType" AS ENUM ('LOAN_COUNT', 'LOAN_PORTFOLIO', 'LOAN_MONTHLY_GROWTH', 'SAVINGS_TARGET', 'EXPENSE_STREAK', 'MANUAL_CHECKLIST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Goal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "GoalType" NOT NULL,
  "targetAmount" DECIMAL(12,2),
  "currentAmount" DECIMAL(12,2),
  "targetCount" INTEGER,
  "currentCount" INTEGER,
  "targetDays" INTEGER,
  "selectedDays" TEXT,
  "startDate" DATE,
  "targetDate" DATE,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "selectedDays" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "startDate" DATE;

CREATE INDEX IF NOT EXISTS "Goal_userId_deletedAt_idx" ON "Goal"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Goal_type_idx" ON "Goal"("type");

DO $$ BEGIN
  ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
