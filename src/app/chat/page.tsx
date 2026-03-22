import { listConversations } from "@/lib/data/chat";
import { getSuggestedPrompts } from "@/lib/chat/suggested-prompts";
import { ChatShell } from "@/components/chat/chat-shell";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const [conversations, suggestedPrompts] = await Promise.all([
    listConversations({ status: "active" }),
    getSuggestedPrompts(),
  ]);

  return (
    <ChatShell
      initialConversations={conversations}
      suggestedPrompts={suggestedPrompts}
    />
  );
}
