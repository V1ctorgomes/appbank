"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

interface PortalLinkCardProps {
  portalUrl: string;
  userId: string;
}

export function PortalLinkCard({ portalUrl, userId }: PortalLinkCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Card title="Link de consulta para clientes" className="mb-6">
      <p className="mb-4 text-sm text-slate-600">
        Envie este link para que o cliente consulte parcelas em aberto e valores devidos
        informando o CPF cadastrado.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 break-all">
          {portalUrl}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="mr-1 h-4 w-4" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="mr-1 h-4 w-4" />
              Copiar
            </>
          )}
        </Button>
        <Link href="/consulta" target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="secondary" size="sm">
            <ExternalLink className="mr-1 h-4 w-4" />
            Abrir
          </Button>
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Na Vercel, adicione a variável{" "}
        <code className="rounded bg-slate-100 px-1">PORTAL_USER_ID</code> com o valor abaixo se
        houver mais de uma conta no sistema:
      </p>
      <code className="mt-1 block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 break-all">
        {userId}
      </code>
    </Card>
  );
}
