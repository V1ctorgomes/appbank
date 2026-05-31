"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await registerUser(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
          <p className="mt-1 text-sm text-slate-500">Comece a gerenciar suas finanças</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome" name="name" required placeholder="Seu nome" />
          <Input
            label="E-mail"
            name="email"
            type="email"
            required
            placeholder="seu@email.com"
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
