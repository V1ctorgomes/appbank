"use client";

import { useEffect, useRef, useState } from "react";
import { sendChatMessage, type ChatMessage } from "@/actions/chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Send, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Como funciona a cobrança diária sem domingo?",
  "Diferença entre empréstimo mensal e por parcelas?",
  "Como editar um empréstimo que já recebi algo?",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function submit(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    const result = await sendChatMessage(nextMessages);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.message) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.message },
      ]);
    }

    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit(input);
    }
  }

  return (
    <div className="flex h-[min(70vh,720px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-primary-50 p-3 text-primary-700">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">
                Assistente AppBank
              </p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Pergunte sobre empréstimos, recebimentos, juros e fluxos do app.
                Respostas via Groq.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void submit(suggestion)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 hover:border-primary-300 hover:bg-primary-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 text-slate-800"
                )}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pensando...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 p-3 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escreva sua pergunta..."
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} className="h-11">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Enter envia · Shift+Enter quebra linha
        </p>
      </form>
    </div>
  );
}
