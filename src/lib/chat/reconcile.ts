import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { recordTermination } from "./stream-telemetry";

const INTERRUPTED_FALLBACK =
  "(Response interrupted. Please try again.)";

const ORPHAN_FALLBACK =
  "(Interrupted — this response was not completed. Please retry.)";

/**
 * Safety-net finalizer called from the chat engine's top-level `finally` block.
 *
 * Guarantees the invariant: no `chat_messages` row remains in
 * `status='streaming'` after `sendMessage()` returns or throws. Catches every
 * code path the engine's own `catch` block misses — most notably async
 * iterator abandonment, where a consumer `break`ing out of a `for await` loop
 * triggers the generator's `return()` method and jumps straight to `finally`,
 * skipping `catch` entirely.
 *
 * No-op if the message is already in a terminal state. Idempotent.
 */
export async function finalizeStreamingMessage(
  messageId: string,
  fullText: string,
): Promise<void> {
  const current = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId))
    .get();

  if (!current || current.status !== "streaming") {
    return;
  }

  const hasContent = fullText && fullText.trim().length > 0;
  const salvage = hasContent ? fullText : INTERRUPTED_FALLBACK;
  const nextStatus = hasContent && fullText.length > 50 ? "complete" : "error";

  db.update(chatMessages)
    .set({ status: nextStatus, content: salvage })
    .where(eq(chatMessages.id, messageId))
    .run();
}

/**
 * Sweep orphaned chat assistant messages left in `status='streaming'` past a
 * reasonable cutoff. These rows are produced when the chat engine's finally
 * block is bypassed (process crash, iterator abandonment under heavy load,
 * HTTP disconnect before update commits, etc.).
 *
 * Safe to call idempotently at chat page load. Uses a 10-minute cutoff — far
 * longer than any legitimate in-flight streaming response — so in-flight rows
 * are never clobbered.
 *
 * Returns the number of rows swept. Never throws.
 */
export async function reconcileStreamingMessages(): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const orphans = db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.status, "streaming"),
        lt(chatMessages.createdAt, cutoff),
      ),
    )
    .all();

  for (const row of orphans) {
    const salvage =
      row.content && row.content.length > 0 ? row.content : ORPHAN_FALLBACK;
    db.update(chatMessages)
      .set({ status: "error", content: salvage })
      .where(eq(chatMessages.id, row.id))
      .run();

    // Telemetry: record the orphan sweep so diagnostics can tell how often
    // the safety net actually fires vs. how often the normal finalize path
    // catches everything first. If this code ever logs a row, the engine's
    // `finally` block missed it.
    recordTermination({
      reason: "stream.reconciled.stale",
      conversationId: row.conversationId ?? null,
      messageId: row.id,
      durationMs: row.createdAt
        ? Date.now() - new Date(row.createdAt).getTime()
        : null,
    });
  }

  return orphans.length;
}
