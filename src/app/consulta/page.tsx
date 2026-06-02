import type { Metadata } from "next";
import { CpfConsulta } from "@/components/portal/cpf-consulta";

export const metadata: Metadata = {
  title: "Consulta de parcelas",
  description: "Consulte suas parcelas em aberto pelo CPF",
};

export default function ConsultaPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Consulta de parcelas</h1>
          <p className="mt-2 text-sm text-slate-600">
            Informe seu CPF para ver o valor em aberto, vencimentos e situação das parcelas.
          </p>
        </div>
        <CpfConsulta />
      </div>
    </div>
  );
}
