"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Zap } from "lucide-react";
import { createAdHocRoutineLog } from "@/actions/routines";

interface AdHocLogModalProps {
  dateStr: string;
  onClose: () => void;
}

export function AdHocLogModal({ dateStr, onClose }: AdHocLogModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Por favor, informe a descrição do imprevisto");
      return;
    }

    try {
      setLoading(true);
      const res = await createAdHocRoutineLog({
        date: dateStr,
        title: title.trim(),
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        notes: notes.trim() || undefined,
      });

      if ((res as any)?.error) {
        setError((res as any).error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Erro ao salvar imprevisto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Registrar Imprevisto</h2>
              <p className="text-xs text-slate-500">Adicione uma alteração ou evento pontual de hoje</p>
            </div>
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              O que aconteceu? (Imprevisto / Evento) *
            </label>
            <Input
              type="text"
              required
              placeholder="Ex: Reunião urgente de cliente, Consulta médica, Levar carro oficina"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações ou Justificativa (opcional)
            </label>
            <Input
              type="text"
              placeholder="Ex: Atrasou o treino das 15h"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
              {loading ? "Registrando..." : "Adicionar Imprevisto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
