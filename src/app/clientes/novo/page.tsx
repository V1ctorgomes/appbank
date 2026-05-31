"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createClient } from "@/actions/clients";
import { ArrowLeft } from "lucide-react";

export default function NovoClientePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await createClient(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/clientes");
      router.refresh();
    }
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href="/clientes"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
      </div>

      <Card className="mx-auto max-w-lg">
        <h1 className="mb-6 text-xl font-bold text-slate-900">Novo Cliente</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome *" name="name" required placeholder="Nome completo" />
          <Input
            label="Telefone *"
            name="phone"
            required
            placeholder="(11) 99999-9999"
          />
          <Input label="CPF *" name="cpf" required placeholder="000.000.000-00" />
          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
              Observações
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Informações adicionais..."
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Cliente"}
            </Button>
            <Link href="/clientes">
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </AppLayout>
  );
}
