"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface TransactionFiltersProps {
  categories: Category[];
  defaultStart: string;
  defaultEnd: string;
}

export function TransactionFilters({
  categories,
  defaultStart,
  defaultEnd,
}: TransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(
    searchParams.get("startDate") ?? defaultStart
  );
  const [endDate, setEndDate] = useState(searchParams.get("endDate") ?? defaultEnd);
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (type) params.set("type", type);
    if (categoryId) params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    router.push(`/movimentacoes?${params.toString()}`);
  }, [startDate, endDate, type, categoryId, search, router]);

  function clearFilters() {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setType("");
    setCategoryId("");
    setSearch("");
    router.push("/movimentacoes");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Input
          label="De"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="Até"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Select
          label="Tipo"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Todos"
          options={[
            { value: "INCOME", label: "Entrada" },
            { value: "EXPENSE", label: "Saída" },
          ]}
        />
        <Select
          label="Categoria"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          placeholder="Todas"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Input
          label="Pesquisa"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Descrição..."
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
        <div className="flex items-end gap-2">
          <Button onClick={applyFilters} className="flex-1">
            <Search className="mr-1 h-4 w-4" />
            Filtrar
          </Button>
          <Button variant="secondary" onClick={clearFilters}>
            Limpar
          </Button>
        </div>
      </div>
    </div>
  );
}
