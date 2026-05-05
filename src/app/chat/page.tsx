import { listConversations } from "@/lib/data/chat";
import { getPromptCategories } from "@/lib/chat/suggested-prompts";
import { reconcileStreamingMessages } from "@/lib/chat/reconcile";
import { listStarters } from "@/lib/apps/starters";
import { ChatShell } from "@/components/chat/chat-shell";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const params = await searchParams;

  // Safety-net sweep: finalize any orphaned streaming rows from crashes,
  // disconnects, or prior releases. Fire-and-forget-ish — we await so the
  // UI never renders stale `streaming` placeholders, but errors are swallowed.
  try {
    await reconcileStreamingMessages();
  } catch (err) {
    console.error("[chat] reconcileStreamingMessages failed:", err);
  }

  const [conversations, promptCategories] = await Promise.all([
    listConversations({ status: "active" }),
    getPromptCategories(),
  ]);
  // listStarters reads YAML files from disk synchronously — cheap, no need to
  // parallelize. Returns [] when the starters dir is missing (e.g. CE install).
  const starters = listStarters();

  return (
    <ChatShell
      initialConversations={conversations}
      promptCategories={promptCategories}
      starters={starters}
      initialActiveId={params.c ?? null}
    />
  );
}
