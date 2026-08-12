"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Calendar, Clock, Coffee, Target } from "lucide-react";
import { createRoutine, updateRoutine } from "@/actions/routines";
import { ICON_OPTIONS, RoutineIcon } from "./routine-icon";

interface RoutineFormModalProps {
  routineToEdit?: any;
  initialStartTime?: string;
  onClose: () => void;
}

const WEEKDAYS = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

export function RoutineFormModal({ routineToEdit, initialStartTime, onClose }: RoutineFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(routineToEdit?.title || "");
  const [description, setDescription] = useState(routineToEdit?.description || "");
  const [icon, setIcon] = useState(routineToEdit?.icon || "target");
  const [type, setType] = useState<"ACTIVITY" | "BREAK_REST" | "GENERAL">(
    routineToEdit?.type || "ACTIVITY"
  );
  const [period, setPeriod] = useState(routineToEdit?.period || "ANYTIME");
  const [startTime, setStartTime] = useState(routineToEdit?.startTime || initialStartTime || "");
  const [endTime, setEndTime] = useState(routineToEdit?.endTime || "");

  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    if (routineToEdit?.daysOfWeek) {
      return routineToEdit.daysOfWeek.split(",").map((d: string) => parseInt(d.trim(), 10));
    }
    return [0, 1, 2, 3, 4, 5, 6];
  });

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length === 1) return; // Mínimo 1 dia
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Por favor, informe o título da rotina");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        icon,
        type,
        period,
        daysOfWeek: selectedDays.sort((a, b) => a - b).join(","),
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        order: 0,
      };

      let res;
      if (routineToEdit?.id) {
        res = await updateRoutine(routineToEdit.id, payload);
      } else {
        res = await createRoutine(payload);
      }

      if ((res as any)?.error) {
        setError((res as any).error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Erro ao salvar rotina");
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
              <Calendar className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {routineToEdit ? "Editar Rotina" : "Nova Rotina Recorrente"}
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
          {/* Título & Ícone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título da Rotina *
            </label>
            <Input
              type="text"
              required
              placeholder="Ex: Treino de Academia, Estudar React, Pausa para Café"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Seletor de Ícones Lucide */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ícone da Atividade
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 border border-slate-200 rounded-lg bg-slate-50">
              {ICON_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const isSelected = icon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setIcon(opt.id)}
                    className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-300"
                        : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    <IconComp className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tipo de Bloco: Atividade vs Descanso */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Bloco *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("ACTIVITY")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  type === "ACTIVITY"
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Target className="h-4 w-4 text-blue-600" />
                🎯 Atividade / Foco
              </button>
              <button
                type="button"
                onClick={() => setType("BREAK_REST")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  type === "BREAK_REST"
                    ? "border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Coffee className="h-4 w-4 text-amber-600" />
                ☕ Pausa / Descanso
              </button>
            </div>
          </div>

          {/* Horários (Início e Fim) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horário de Início (opcional)
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horário de Término (opcional)
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Período do Dia */}
          <Select
            label="Período do Dia"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              { value: "ANYTIME", label: "⏰ Qualquer Horário" },
              { value: "MORNING", label: "🌅 Manhã (05:00 - 12:00)" },
              { value: "AFTERNOON", label: "☀️ Tarde (12:00 - 18:00)" },
              { value: "EVENING", label: "🌙 Noite (18:00 - 23:59)" },
            ]}
          />

          {/* Dias da Semana */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Dias da Semana *
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                  className="text-blue-600 hover:underline"
                >
                  Seg-Sex
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                  className="text-blue-600 hover:underline"
                >
                  Todos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((w) => {
                const isActive = selectedDays.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleDay(w.id)}
                    className={`py-2 text-center rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição / Detalhes (opcional)
            </label>
            <Input
              type="text"
              placeholder="Ex: Focar 50 min e descansar 10 min"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : routineToEdit ? "Salvar Alterações" : "Criar Rotina"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
