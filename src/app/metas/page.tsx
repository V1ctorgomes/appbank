import { AppLayout } from "@/components/layout/app-layout";
import { getGoals, getGoalsSummary } from "@/actions/goals";
import { GoalsContainer } from "@/components/goals/goals-container";

export const metadata = {
  title: "Metas e Objetivos | Financeiro Pessoal",
  description: "Acompanhe e gerencie suas metas de empréstimos, economia e hábitos financeiros.",
};

export default async function MetasPage() {
  const [goals, summary] = await Promise.all([
    getGoals("ALL"),
    getGoalsSummary(),
  ]);

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
