"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createCategory, deleteCategory } from "@/actions/categories";
import { Trash2 } from "lucide-react";
import { PortalLinkCard } from "./portal-link-card";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface CategoriesManagerProps {
  categories: Category[];
  portalUrl: string;
  userId: string;
}

function CategorySection({
  title,
  type,
  categories,
  onRefresh,
}: {
  title: string;
  type: "INCOME" | "EXPENSE";
  categories: Category[];
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = categories.filter((c) => c.type === type);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("type", type);

    const result = await createCategory(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setName("");
    setLoading(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir esta categoria?")) return;
    await deleteCategory(id);
    onRefresh();
  }

  return (
    <Card title={title}>
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova categoria..."
          required
          className="flex-1"
        />
        <Button type="submit" disabled={loading} size="sm">
          Adicionar
        </Button>
      </form>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma categoria cadastrada.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
            >
              <span className="text-sm text-slate-700">{cat.name}</span>
              <button
                onClick={() => handleDelete(cat.id)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Excluir ${cat.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CategoriesManager({ categories, portalUrl, userId }: CategoriesManagerProps) {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Gerencie categorias e o link de consulta para clientes</p>
      </div>

      <PortalLinkCard portalUrl={portalUrl} userId={userId} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategorySection
          title="Categorias de Entrada"
          type="INCOME"
          categories={categories}
          onRefresh={() => router.refresh()}
        />
        <CategorySection
          title="Categorias de Saída"
          type="EXPENSE"
          categories={categories}
          onRefresh={() => router.refresh()}
        />
      </div>
    </AppLayout>
  );
}
