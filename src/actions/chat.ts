"use server";

import { requireAuth } from "@/lib/auth-utils";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

const SYSTEM_PROMPT = `Você é o assistente do AppBank, um sistema de gestão financeira pessoal focado em clientes, vendas, empréstimos (mensal, semanal, diária e quinzenal), recebimentos, movimentações, metas e relatórios.

Responda sempre em português do Brasil, de forma clara e objetiva.
Ajude o usuário a entender fluxos do app, interpretar saldos, juros, parcelas e boas práticas financeiras.
Não invente dados do banco do usuário: você não tem acesso direto aos registros; peça contexto quando precisar.
Não peça nem repita chaves de API ou senhas.`;

const DEFAULT_MODEL = "openai/gpt-oss-20b";

export async function sendChatMessage(messages: ChatMessage[]) {
  await requireAuth();

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return {
      error:
        "GROQ_API_KEY não configurada. Defina a variável no ambiente (local ou Vercel).",
    };
  }

  const cleaned = messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 4000),
    }));

  if (cleaned.length === 0) {
    return { error: "Envie uma mensagem para começar." };
  }

  const last = cleaned[cleaned.length - 1];
  if (last.role !== "user") {
    return { error: "A última mensagem precisa ser do usuário." };
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
          temperature: 0.6,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...cleaned],
        }),
      }
    );

    const data = (await response.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };

    if (!response.ok) {
      return {
        error:
          data.error?.message ??
          `Erro na API Groq (${response.status}). Verifique a chave e o modelo.`,
      };
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { error: "A Groq não retornou resposta." };
    }

    return { success: true as const, message: content };
  } catch {
    return { error: "Falha ao conectar na API da Groq. Tente novamente." };
  }
}
