"use client";

import { useState, useEffect } from "react";
import { X, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createGoal, updateGoal } from "@/actions/goals";
import { formatDateForInput } from "@/lib/utils";

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalToEdit?: any | null;
}

export function GoalFormModal({ isOpen, onClose, goalToEdit }: GoalFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("LOAN_COUNT");
  const [targetCount, setTargetCount] = useState<string>("10");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [targetDays, setTargetDays] = useState<string>("7");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg-Sex por padrão
  const [startDate, setStartDate] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const weekdaysList = [
    { id: 1, label: "Seg" },
    { id: 2, label: "Ter" },
    { id: 3, label: "Qua" },
    { id: 4, label: "Qui" },
    { id: 5, label: "Sex" },
    { id: 6, label: "Sáb" },
    { id: 0, label: "Dom" },
  ];

  useEffect(() => {
    const todayStr = formatDateForInput(new Date());

    if (goalToEdit) {
      setTitle(goalToEdit.title ?? "");
      setDescription(goalToEdit.description ?? "");
      setType(goalToEdit.type ?? "LOAN_COUNT");
      setTargetCount(goalToEdit.targetCount ? String(goalToEdit.targetCount) : "");
      setTargetAmount(goalToEdit.targetAmount ? String(goalToEdit.targetAmount) : "");
      setTargetDays(goalToEdit.targetDays ? String(goalToEdit.targetDays) : "");
      if (goalToEdit.selectedDays) {
        const days = goalToEdit.selectedDays.split(",").map((d: string) => parseInt(d.trim(), 10));
        setSelectedDays(days.filter((d: number) => !isNaN(d)));
      } else {
        setSelectedDays([1, 2, 3, 4, 5]);
      }
      setStartDate(
        goalToEdit.startDate
          ? formatDateForInput(goalToEdit.startDate)
          : todayStr
      );
      setTargetDate(
        goalToEdit.targetDate
          ? formatDateForInput(goalToEdit.targetDate)
          : ""
      );
    } else {
      setTitle("");
      setDescription("");
      setType("LOAN_COUNT");
      setTargetCount("10");
      setTargetAmount("5000");
      setTargetDays("7");
      setSelectedDays([1, 2, 3, 4, 5]);
      setStartDate(todayStr);
      setTargetDate("");
    }
    setError("");
  }, [goalToEdit, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length === 1) return; // Mantém pelo menos um dia
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId].sort((a, b) => a - b));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: any = {
        title,
        description: description || undefined,
        type,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
      };

      if (type === "LOAN_COUNT") {
        payload.targetCount = targetCount ? parseInt(targetCount, 10) : undefined;
      } else if (type === "LOAN_PORTFOLIO" || type === "SAVINGS_TARGET") {
        payload.targetAmount = targetAmount ? parseFloat(targetAmount) : undefined;
      } else if (type === "EXPENSE_STREAK") {
        payload.targetDays = targetDays ? parseInt(targetDays, 10) : undefined;
        payload.selectedDays = selectedDays.join(",");
      }

      let res;
      if (goalToEdit) {
        res = await updateGoal(goalToEdit.id, payload);
      } else {
        res = await createGoal(payload);
      }

      if (res?.error) {
        setError(res.error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Erro ao salvar meta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Target className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {goalToEdit ? "Editar Meta" : "Nova Meta / Objetivo"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tipo de Meta */}
          <Select
            label="Tipo de Meta"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full"
            options={[
              { value: "LOAN_COUNT", label: "🤝 Qtd. de Empréstimos Simultâneos" },
              { value: "LOAN_PORTFOLIO", label: "💰 Valor em Carteira de Empréstimos (R$)" },
              { value: "SAVINGS_TARGET", label: "✈️ Meta / Viagem / Economia (R$)" },
              { value: "EXPENSE_STREAK", label: "🔥 Dias Sem Gastar (Streak)" },
              { value: "MANUAL_CHECKLIST", label: "📋 Meta Manual / Checklist" },
            ]}
          />

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título da Meta *
            </label>
            <Input
              type="text"
              required
              placeholder={
                type === "LOAN_COUNT"
                  ? "Ex: Atingir 10 empréstimos simultâneos"
                  : type === "LOAN_PORTFOLIO"
                  ? "Ex: Manter R$ 15.000 emprestados simultaneamente"
                  : type === "SAVINGS_TARGET"
                  ? "Ex: Viagem no final do ano"
                  : type === "EXPENSE_STREAK"
                  ? "Ex: Ficar 7 dias sem registrar despesas"
                  : "Ex: Organizar recibos dos clientes"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Campos Dinâmicos por Tipo */}
          {type === "LOAN_COUNT" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantidade Alvo de Empréstimos Simultâneos *
              </label>
              <Input
                type="number"
                min="1"
                required
                placeholder="Ex: 10"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
              />
            </div>
          )}

          {(type === "LOAN_PORTFOLIO" || type === "SAVINGS_TARGET") && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Alvo (R$) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="Ex: 5000.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </div>
          )}

          {type === "EXPENSE_STREAK" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantidade de Dias sem Gastar *
                </label>
                <Input
                  type="number"
                  min="1"
                  required
                  placeholder="Ex: 7"
                  value={targetDays}
                  onChange={(e) => setTargetDays(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Dias da Semana Válidos
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                      className="text-blue-600 hover:underline"
                    >
                      Seg-Sex
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDays([0, 6])}
                      className="text-blue-600 hover:underline"
                    >
                      Finais de semana
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-blue-600 hover:underline"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {weekdaysList.map((day) => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Datas (Início & Final/Prazo) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Início
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data Final / Prazo (Opcional)
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observação / Descrição (Opcional)
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Detalhes adicionais sobre como pretende atingir esta meta..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvo..." : goalToEdit ? "Salvar Alterações" : "Criar Meta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
