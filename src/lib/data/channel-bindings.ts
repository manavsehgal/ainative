import { db } from "@/lib/db";
import { channelBindings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Queries ────────────────────────────────────────────────────────────

/** Find a binding by channel config + thread (the primary lookup for inbound messages). */
export function getBindingByConfigAndThread(
  channelConfigId: string,
  externalThreadId: string | null
) {
  if (externalThreadId) {
    return db
      .select()
      .from(channelBindings)
      .where(
        and(
          eq(channelBindings.channelConfigId, channelConfigId),
          eq(channelBindings.externalThreadId, externalThreadId)
        )
      )
      .get();
  }
  // Null thread — single-conversation mode (first binding for this config with no thread)
  return db
    .select()
    .from(channelBindings)
    .where(eq(channelBindings.channelConfigId, channelConfigId))
    .get();
}

/** Get a binding by its own ID. */
export function getBinding(id: string) {
  return db.select().from(channelBindings).where(eq(channelBindings.id, id)).get();
}

/** List all bindings for a channel config. */
export function listBindingsForConfig(channelConfigId: string) {
  return db
    .select()
    .from(channelBindings)
    .where(eq(channelBindings.channelConfigId, channelConfigId))
    .all();
}

/** List all active bindings. */
export function listActiveBindings() {
  return db
    .select()
    .from(channelBindings)
    .where(eq(channelBindings.status, "active"))
    .all();
}

// ── Mutations ──────────────────────────────────────────────────────────

/** Create a new binding. */
export function createBinding(values: typeof channelBindings.$inferInsert) {
  return db.insert(channelBindings).values(values).run();
}

/** Update a binding's pending request ID (for permission flow). */
export function setPendingRequest(bindingId: string, requestId: string | null) {
  const now = new Date();
  return db
    .update(channelBindings)
    .set({ pendingRequestId: requestId, updatedAt: now })
    .where(eq(channelBindings.id, bindingId))
    .run();
}

/** Update binding status (active/paused/archived). */
export function updateBindingStatus(bindingId: string, status: "active" | "paused" | "archived") {
  const now = new Date();
  return db
    .update(channelBindings)
    .set({ status, updatedAt: now })
    .where(eq(channelBindings.id, bindingId))
    .run();
}

/** Delete a binding. */
export function deleteBinding(bindingId: string) {
  return db.delete(channelBindings).where(eq(channelBindings.id, bindingId)).run();
}
