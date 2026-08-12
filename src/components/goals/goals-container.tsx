"use client";

import { useState } from "react";
import { Plus, Target, CheckCircle2, Clock, Trophy, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/card";
import { GoalCard } from "./goal-card";
import { GoalFormModal } from "./goal-form-modal";

interface GoalsContainerProps {
  initialGoals: any[];
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    averageProgress: number;
  };
}

export function GoalsContainer({ initialGoals, summary }: GoalsContainerProps) {
  const [filter, setFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<any | null>(null);

  const filteredGoals = initialGoals.filter((goal) => {
    if (filter === "ACTIVE") return !goal.isCompleted;
    if (filter === "COMPLETED") return goal.isCompleted;
    if (filter === "LOANS") return goal.type === "LOAN_COUNT" || goal.type === "LOAN_PORTFOLIO" || goal.type === "LOAN_MONTHLY_GROWTH";
    if (filter === "SAVINGS") return goal.type === "SAVINGS_TARGET";
    if (filter === "HABITS") return goal.type === "EXPENSE_STREAK" || goal.type === "MANUAL_CHECKLIST";
    return true;
  });

  const handleOpenCreate = () => {
    setGoalToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (goal: any) => {
    setGoalToEdit(goal);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Metas"
          value={summary.total.toString()}
          subtitle="Metas cadastradas no sistema"
        />
        <StatCard
          title="Em Andamento"
          value={summary.inProgress.toString()}
          subtitle="Aguardando conclusão"
          variant="warning"
        />
        <StatCard
          title="Metas Concluídas"
          value={summary.completed.toString()}
          subtitle="Objetivos alcançados"
          variant="income"
        />
        <StatCard
          title="Progresso Geral"
          value={`${summary.averageProgress}%`}
          subtitle="Taxa média de sucesso"
        />
      </div>

      {/* Barra Superior & Filtros */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        {/* Abas de Filtro */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ALL", label: "Todas" },
            { id: "ACTIVE", label: "Em Andamento" },
            { id: "LOANS", label: "Empréstimos" },
            { id: "SAVINGS", label: "Viagens & Projetos" },
            { id: "HABITS", label: "Hábitos & Streaks" },
            { id: "COMPLETED", label: "Concluídas" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Botão Nova Meta */}
        <Button onClick={handleOpenCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Meta
        </Button>
      </div>

      {/* Grid de Metas */}
      {filteredGoals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onEdit={handleOpenEdit} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="rounded-full bg-blue-50 p-4 text-blue-600 mb-3">
            <Target className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            Nenhuma meta encontrada
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            {filter === "ALL"
              ? "Você ainda não possui metas cadastradas. Clique no botão abaixo para definir sua primeira meta!"
              : "Não há metas correspondentes ao filtro selecionado."}
          </p>
          <Button onClick={handleOpenCreate} className="mt-4 flex items-center gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Criar Minha Primeira Meta
          </Button>
        </div>
      )}

      {/* Modal Form */}
      <GoalFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        goalToEdit={goalToEdit}
      />
    </div>
  );
}
