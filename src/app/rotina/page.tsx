import { AppLayout } from "@/components/layout/app-layout";
import { getRoutinesForDate } from "@/actions/routines";
import { RoutineContainer } from "@/components/routines/routine-container";

export const metadata = {
  title: "Rotina & Hábitos | Financeiro Pessoal",
  description: "Gerencie suas rotinas diárias, horários, intervalos de descanso e imprevistos.",
};

export default async function RotinaPage() {
  let initialData = {
    dateStr: new Date().toISOString().split("T")[0],
    items: [],
    summary: { total: 0, completed: 0, percentage: 0 },
  };

  try {
    initialData = await getRoutinesForDate();
  } catch (err) {
    console.error("Erro ao carregar dados de rotina no servidor:", err);
  }

  return (
    <AppLayout>
      <RoutineContainer initialData={initialData} />
    </AppLayout>
  );
}
