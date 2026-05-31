"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { updateClient, deleteClient } from "@/actions/clients";
import { formatPhone, formatCpf } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface EditClientPageProps {
  client: {
    id: string;
    name: string;
    phone: string;
    cpf: string;
    notes: string | null;
  };
}

export function EditClientForm({ client }: EditClientPageProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await updateClient(client.id, formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/clientes/${client.id}`);
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!confirm("Deseja realmente excluir este cliente?")) return;

    setLoading(true);
    await deleteClient(client.id);
    router.push("/clientes");
    router.refresh();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={`/clientes/${client.id}`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
      </div>

      <Card className="mx-auto max-w-lg">
        <h1 className="mb-6 text-xl font-bold text-slate-900">Editar Cliente</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome *"
            name="name"
            required
            defaultValue={client.name}
          />
          <Input
            label="Telefone *"
            name="phone"
            required
            defaultValue={formatPhone(client.phone)}
          />
          <Input
            label="CPF *"
            name="cpf"
            required
            defaultValue={formatCpf(client.cpf)}
          />
          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
              Observações
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={client.notes ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Link href={`/clientes/${client.id}`}>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={loading}
              className="ml-auto"
            >
              Excluir
            </Button>
          </div>
        </form>
      </Card>
    </AppLayout>
  );
}
