"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/actions/transactions";
import type { TransactionInput } from "@/lib/schemas";
import { X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionFormData {
  id?: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  categoryId: string;
  value: string;
  date: string;
  notes: string;
}

interface TransactionModalProps {
  categories: Category[];
  transaction?: TransactionFormData;
  onClose: () => void;
}

export function TransactionModal({
  categories,
  transaction,
  onClose,
}: TransactionModalProps) {
  const router = useRouter();
  const isEdit = !!transaction?.id;

  const [type, setType] = useState<"INCOME" | "EXPENSE">(
    transaction?.type ?? "EXPENSE"
  );
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [value, setValue] = useState(transaction?.value ?? "");
  const [date, setDate] = useState(
    transaction?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload: TransactionInput = {
      type,
      description,
      categoryId: categoryId || undefined,
      value: parseFloat(value),
      date,
      notes: notes || undefined,
    };

    const result = isEdit
      ? await updateTransaction(transaction!.id!, payload)
      : await createTransaction(payload);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!transaction?.id) return;
    if (!confirm("Deseja excluir esta movimentação?")) return;

    setLoading(true);
    const result = await deleteTransaction(transaction.id);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "Editar Movimentação" : "Nova Movimentação"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Tipo *</label>
            <div className="flex gap-3">
              {(["INCOME", "EXPENSE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setCategoryId("");
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    type === t
                      ? t === "INCOME"
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-red-600 bg-red-50 text-red-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t === "INCOME" ? "Entrada" : "Saída"}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Descrição *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Ex: Compra no mercado"
          />

          <Select
            label="Categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder="Selecione (opcional)"
            options={filteredCategories.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor *"
              type="number"
              step="0.01"
              min="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <Input
              label="Data *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="tx-notes" className="block text-sm font-medium text-slate-700">
              Observação
            </label>
            <textarea
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : isEdit ? "Salvar" : "Registrar"}
            </Button>
            {isEdit && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={loading}
              >
                Excluir
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface NewTransactionButtonProps {
  categories: Category[];
}

export function NewTransactionButton({ categories }: NewTransactionButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nova Movimentação</Button>
      {open && (
        <TransactionModal categories={categories} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

interface EditTransactionButtonProps {
  categories: Category[];
  transaction: TransactionFormData & { id: string };
}

export function EditTransactionButton({
  categories,
  transaction,
}: EditTransactionButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>
      {open && (
        <TransactionModal
          categories={categories}
          transaction={transaction}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
