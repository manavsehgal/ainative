import { listConversations } from "@/lib/data/chat";
import { getPromptCategories } from "@/lib/chat/suggested-prompts";
import { ChatShell } from "@/components/chat/chat-shell";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const [conversations, promptCategories] = await Promise.all([
    listConversations({ status: "active" }),
    getPromptCategories(),
  ]);

  return (
    <ChatShell
      initialConversations={conversations}
      promptCategories={promptCategories}
    />
  );
}
