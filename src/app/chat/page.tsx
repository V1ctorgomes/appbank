import { AppLayout } from "@/components/layout/app-layout";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Chat com IA</h1>
        <p className="text-slate-500">
          Converse com o assistente do AppBank (powered by Groq).
        </p>
      </div>
      <ChatPanel />
    </AppLayout>
  );
}
