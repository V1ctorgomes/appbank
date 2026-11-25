"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PiggyBank, Repeat, Shield, Wallet } from "lucide-react";
import type {
  PlanningCategory,
  PlanningCategoryKey,
  PlanningData,
} from "@/actions/planning";
import { cn, formatCurrency } from "@/lib/utils";

type Settings = {
  reservePct: number;
  personalPct: Record<PlanningCategoryKey, number>;
};

const STORAGE_KEY = "appbank:planejamento:v1";

const DEFAULT_SETTINGS: Settings = {
  reservePct: 10,
  personalPct: { loans: 50, rentals: 50, sales: 50 },
};

const CATEGORY_INFO: Record<
  PlanningCategoryKey,
  { label: string; profitRule: string; reinvestedLabel?: string; missingHref: string; missingNoun: string }
> = {
  loans: {
    label: "Empréstimos",
    profitRule: "Lucro = juros recebidos. Amortização volta como capital.",
    reinvestedLabel: "Já liberado em novos empréstimos",
    missingHref: "/emprestimos",
    missingNoun: "empréstimo(s)",
  },
  rentals: {
    label: "Aluguel de motos",
    profitRule: "Lucro = parcela − parte proporcional do custo da moto.",
    reinvestedLabel: "Custo de motos de contratos iniciados no mês",
    missingHref: "/alugueis",
    missingNoun: "aluguel(éis)",
  },
  sales: {
    label: "Vendas",
    profitRule: "Lucro = recebido − parte proporcional do custo da mercadoria.",
    missingHref: "/vendas",
    missingNoun: "venda(s)",
  },
};

function clampPct(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      reservePct: clampPct(parsed?.reservePct, DEFAULT_SETTINGS.reservePct),
      personalPct: {
        loans: clampPct(parsed?.personalPct?.loans, 50),
        rentals: clampPct(parsed?.personalPct?.rentals, 50),
        sales: clampPct(parsed?.personalPct?.sales, 50),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sem armazenamento disponível: mantém só na sessão.
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

function allocate(category: PlanningCategory, reservePct: number, personalPct: number) {
  const reserve = round((category.profit * reservePct) / 100);
  const personal = round(((category.profit - reserve) * personalPct) / 100);
  const reinvest = round(category.received - reserve - personal);
  const missing =
    category.reinvestedThisMonth == null
      ? null
      : round(Math.max(0, reinvest - category.reinvestedThisMonth));
  return { reserve, personal, reinvest, missing };
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-medium tabular-nums text-slate-800", className)}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function PlanningCard({
  data,
  only,
}: {
  data: PlanningData;
  only?: PlanningCategoryKey[];
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function update(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  const categories = data.categories.filter(
    (c) => !only || only.includes(c.key)
  );
  const allocations = categories.map((c) => ({
    category: c,
    ...allocate(c, settings.reservePct, settings.personalPct[c.key]),
  }));

  const totals = allocations.reduce(
    (acc, a) => ({
      received: acc.received + a.category.received,
      personal: acc.personal + a.personal,
      reinvest: acc.reinvest + a.reinvest,
      reserve: acc.reserve + a.reserve,
    }),
    { received: 0, personal: 0, reinvest: 0, reserve: 0 }
  );

  const nothingReceived = totals.received <= 0;

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Wallet className="h-5 w-5 text-primary-600" />
            Quanto gastar e quanto reinvestir
          </h3>
          <p className="text-sm text-slate-500">
            Baseado no que você recebeu em {data.monthLabel}. O capital que voltou
            (principal, custo da moto, custo da mercadoria) vai todo para reinvestir;
            só o lucro é dividido.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          <Shield className="h-4 w-4 text-amber-600" />
          Reserva para atrasos
          <input
            type="number"
            min={0}
            max={100}
            value={settings.reservePct}
            onChange={(e) =>
              update({
                ...settings,
                reservePct: clampPct(e.target.value, settings.reservePct),
              })
            }
            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
            aria-label="Percentual do lucro para reserva"
          />
          % do lucro
        </label>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <PiggyBank className="h-4 w-4 text-green-700" />
            Pode gastar com você
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-700">
            {formatCurrency(totals.personal)}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-primary-50/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <Repeat className="h-4 w-4 text-primary-700" />
            Reinvestir no negócio
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary-700">
            {formatCurrency(totals.reinvest)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <Shield className="h-4 w-4 text-amber-700" />
            Guardar de reserva
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
            {formatCurrency(totals.reserve)}
          </p>
        </div>
      </div>

      {nothingReceived && (
        <p className="mb-4 text-sm text-slate-500">
          Nenhum recebimento registrado neste mês ainda. Os valores aparecem conforme
          você registra os pagamentos.
        </p>
      )}

      <div
        className={cn(
          "grid gap-4",
          categories.length === 3 && "lg:grid-cols-3",
          categories.length === 2 && "lg:grid-cols-2"
        )}
      >
        {allocations.map(({ category, personal, reinvest, reserve, missing }) => {
          const info = CATEGORY_INFO[category.key];
          const pct = settings.personalPct[category.key];
          return (
            <div
              key={category.key}
              className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-800">{info.label}</p>
                <p className="text-xs text-slate-400">{info.profitRule}</p>
              </div>

              <div className="space-y-1">
                <Row label="Recebido no mês" value={category.received} />
                <Row
                  label="Lucro"
                  value={category.profit}
                  className="text-green-700"
                />
                <Row label="Capital devolvido" value={category.capital} />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Do lucro, para você</span>
                  <span className="font-medium text-slate-700">{pct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={pct}
                  onChange={(e) =>
                    update({
                      ...settings,
                      personalPct: {
                        ...settings.personalPct,
                        [category.key]: clampPct(e.target.value, pct),
                      },
                    })
                  }
                  className="w-full accent-primary-600"
                  aria-label={`Percentual do lucro de ${info.label} para você`}
                />
              </div>

              <div className="space-y-1">
                <Row
                  label="Pode gastar"
                  value={personal}
                  className="text-green-700"
                />
                <Row
                  label="Reinvestir"
                  value={reinvest}
                  className="text-primary-700"
                />
                <Row label="Reserva" value={reserve} className="text-amber-700" />
              </div>

              {category.reinvestedThisMonth != null && info.reinvestedLabel && (
                <div className="space-y-1 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">{info.reinvestedLabel}</span>
                    <span className="font-medium tabular-nums text-slate-700">
                      {formatCurrency(category.reinvestedThisMonth)}
                    </span>
                  </div>
                  {reinvest > 0 && (
                    <p
                      className={cn(
                        "font-medium",
                        missing && missing > 0 ? "text-primary-700" : "text-green-700"
                      )}
                    >
                      {missing && missing > 0
                        ? `Ainda falta reinvestir ${formatCurrency(missing)}`
                        : "Reinvestimento do mês já coberto"}
                    </p>
                  )}
                </div>
              )}

              {category.unknownCostCount > 0 && (
                <div className="flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    {formatCurrency(category.unknownCostReceived)} de{" "}
                    {category.unknownCostCount} {info.missingNoun} sem custo
                    informado foi tratado como capital (reinvestir).{" "}
                    <Link href={info.missingHref} className="font-medium underline">
                      Informar custo
                    </Link>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
