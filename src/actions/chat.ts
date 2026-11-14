"use server";

import { requireAuth } from "@/lib/auth-utils";
import {
  buildChatSnapshot,
  chatToolDefinitions,
  executeChatTool,
} from "@/lib/chat-tools";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

type GroqMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string | null;
      tool_calls?: GroqToolCall[];
    }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type GroqChoiceMessage = {
  role: "assistant";
  content?: string | null;
  tool_calls?: GroqToolCall[];
};

const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MAX_TOOL_ROUNDS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetrySeconds(message: string) {
  const match = message.match(/try again in ([0-9.]+)s/i);
  if (!match) return 4;
  return Math.min(Math.ceil(Number(match[1]) + 0.5), 20);
}

function isRateLimitError(message: string) {
  return /rate limit|tokens per minute|tpm/i.test(message);
}

function truncateJson(value: unknown, max = 5000) {
  const text = JSON.stringify(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…[truncado]`;
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  withTools: boolean
) {
  let lastError = "Erro na API Groq.";

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1200,
          messages,
          ...(withTools
            ? {
                tools: chatToolDefinitions,
                tool_choice: "auto",
              }
            : {}),
        }),
      }
    );

    const data = (await response.json()) as {
      error?: { message?: string };
      choices?: { message?: GroqChoiceMessage }[];
    };

    if (response.ok) {
      return data.choices?.[0]?.message;
    }

    lastError =
      data.error?.message ??
      `Erro na API Groq (${response.status}). Verifique a chave e o modelo.`;

    if (response.status === 429 || isRateLimitError(lastError)) {
      if (attempt < 2) {
        await sleep(parseRetrySeconds(lastError) * 1000);
        continue;
      }
      throw new Error(
        "A Groq atingiu o limite gratuito de tokens por minuto. Espere ~10s e tente de novo, ou faça upgrade em console.groq.com/settings/billing."
      );
    }

    throw new Error(lastError);
  }

  throw new Error(lastError);
}

export async function sendChatMessage(messages: ChatMessage[]) {
  const user = await requireAuth();

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
    .slice(-8)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.trim().slice(0, 1500),
    }));

  if (cleaned.length === 0) {
    return { error: "Envie uma mensagem para começar." };
  }

  if (cleaned[cleaned.length - 1].role !== "user") {
    return { error: "A última mensagem precisa ser do usuário." };
  }

  let snapshotText = "";
  try {
    const snapshot = await buildChatSnapshot(user.id);
    snapshotText = truncateJson(snapshot, 2500);
  } catch {
    snapshotText = '{"erro":"falha ao carregar resumo"}';
  }

  const systemPrompt = `Assistente do AppBank. Responda em pt-BR com dados reais.
Snapshot atual do usuário (use primeiro; só chame query_app se faltar detalhe):
${snapshotText}
Regras: não invente números; não peça senhas; só consulta (sem criar/editar/pagar).`;

  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const conversation: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...cleaned,
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const message = await callGroq(apiKey, model, conversation, true);
      if (!message) {
        return { error: "A Groq não retornou resposta." };
      }

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const content = message.content?.trim();
        if (!content) {
          return { error: "A Groq não retornou resposta." };
        }
        return { success: true as const, message: content };
      }

      conversation.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: toolCalls,
      });

      // gpt-oss-20b não garante parallel tools — executa em sequência, no máx. 2 por rodada
      for (const call of toolCalls.slice(0, 2)) {
        const result = await executeChatTool(
          user.id,
          call.function.name,
          call.function.arguments ?? "{}"
        );
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: truncateJson(result, 4000),
        });
      }
    }

    const finalMessage = await callGroq(apiKey, model, conversation, false);
    const content = finalMessage?.content?.trim();
    if (!content) {
      return {
        error:
          "Consultei os dados, mas não consegui montar a resposta. Tente de novo em alguns segundos.",
      };
    }
    return { success: true as const, message: content };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Falha ao conectar na API da Groq.";
    return { error: msg };
  }
}
