"use server";

import { requireAuth } from "@/lib/auth-utils";
import { chatToolDefinitions, executeChatTool } from "@/lib/chat-tools";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

type GroqMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
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

const SYSTEM_PROMPT = `Você é o assistente do AppBank, sistema de gestão financeira pessoal (clientes, vendas, empréstimos, recebimentos, movimentações, metas, rotina e relatórios).

Você TEM acesso aos dados reais do usuário autenticado por meio de ferramentas.
Sempre que a pergunta envolver números, saldos, clientes, empréstimos, vendas, recebimentos, atrasados, metas ou movimentações, use as ferramentas antes de responder.
Não invente valores: use apenas o que as ferramentas retornarem.
Responda em português do Brasil, de forma clara e objetiva, com valores formatados.
Se faltar um nome ou filtro, pergunte ou busque com a ferramenta de pesquisa.
Não peça nem repita chaves de API ou senhas.
Não execute alterações (criar/editar/excluir/pagar): apenas consulta e orientação.`;

const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MAX_TOOL_ROUNDS = 6;

async function callGroq(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  withTools: boolean
) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages,
      ...(withTools
        ? {
            tools: chatToolDefinitions,
            tool_choice: "auto",
          }
        : {}),
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    choices?: { message?: GroqChoiceMessage; finish_reason?: string }[];
  };

  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        `Erro na API Groq (${response.status}). Verifique a chave e o modelo.`
    );
  }

  return data.choices?.[0]?.message;
}

function truncateJson(value: unknown, max = 12000) {
  const text = JSON.stringify(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…[truncado]`;
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
    .slice(-16)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.trim().slice(0, 4000),
    }));

  if (cleaned.length === 0) {
    return { error: "Envie uma mensagem para começar." };
  }

  if (cleaned[cleaned.length - 1].role !== "user") {
    return { error: "A última mensagem precisa ser do usuário." };
  }

  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const conversation: GroqMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
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

      for (const call of toolCalls) {
        const result = await executeChatTool(
          user.id,
          call.function.name,
          call.function.arguments ?? "{}"
        );
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: truncateJson(result),
        });
      }
    }

    // Última tentativa sem tools para fechar a resposta
    const finalMessage = await callGroq(apiKey, model, conversation, false);
    const content = finalMessage?.content?.trim();
    if (!content) {
      return {
        error:
          "Consultei os dados, mas não consegui montar a resposta final. Tente de novo com um pedido mais específico.",
      };
    }
    return { success: true as const, message: content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao conectar na API da Groq.";
    return { error: msg };
  }
}
