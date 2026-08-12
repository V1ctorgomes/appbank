import { AppLayout } from "@/components/layout/app-layout";
import { getRoutinesForDate } from "@/actions/routines";
import { RoutineContainer } from "@/components/routines/routine-container";

export const metadata = {
  title: "Rotina & Hábitos | Financeiro Pessoal",
  description: "Gerencie suas rotinas diárias, horários, intervalos de descanso e imprevistos.",
};

export default async function RotinaPage() {
  const initialData = await getRoutinesForDate();

  return (
    <AppLayout>
      <RoutineContainer initialData={initialData} />
    </AppLayout>
  );
}
