import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ADMIN_WHATSAPP_DISPLAY,
  ADMIN_WHATSAPP_URL,
  REGISTRATION_DISABLED_MESSAGE,
} from "@/lib/admin-contact";
import { MessageCircle } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Cadastro indisponível</h1>
          <p className="mt-3 text-sm text-slate-600">{REGISTRATION_DISABLED_MESSAGE}</p>
        </div>

        <p className="mb-4 text-sm text-slate-500">Entre em contato pelo WhatsApp:</p>
        <p className="mb-6 font-semibold text-slate-800">{ADMIN_WHATSAPP_DISPLAY}</p>

        <a
          href={ADMIN_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full"
        >
          <Button type="button" className="w-full">
            <MessageCircle className="mr-2 h-4 w-4" />
            Falar com o administrador
          </Button>
        </a>

        <p className="mt-6 text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
