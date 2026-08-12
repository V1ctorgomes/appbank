import { AppLayout } from "@/components/layout/app-layout";
import { getGoals, getGoalsSummary } from "@/actions/goals";
import { GoalsContainer } from "@/components/goals/goals-container";

export const metadata = {
  title: "Metas e Objetivos | Financeiro Pessoal",
  description: "Acompanhe e gerencie suas metas de empréstimos, economia e hábitos financeiros.",
};

export default async function MetasPage() {
  let goals: any[] = [];
  let summary = { total: 0, completed: 0, inProgress: 0, averageProgress: 0 };

  try {
    const res = await Promise.all([getGoals("ALL"), getGoalsSummary()]);
    goals = res[0] || [];
    summary = res[1] || summary;
  } catch (err) {
    console.error("Erro ao carregar metas no servidor:", err);
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Metas & Objetivos</h1>
        <p className="text-slate-500 text-sm">
          Defina metas de empréstimos simultâneos, projetos pessoais, economia e hábitos financeiros.
        </p>
      </div>

      <GoalsContainer initialGoals={goals} summary={summary} />
    </AppLayout>
  );
}
