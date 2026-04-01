import { db } from "@/lib/db";
import { agentMemory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Apply time-based decay to all active memories.
 * Confidence decreases based on each memory's decayRate and time since last access.
 * Memories below threshold are marked as decayed or archived.
 */
export function applyMemoryDecay(): { decayed: number; archived: number } {
  const now = Date.now();
  const nowDate = new Date(now);
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  // Query all active memories
  const activeMemories = db
    .select()
    .from(agentMemory)
    .where(eq(agentMemory.status, "active"))
    .all();

  let decayed = 0;
  let archived = 0;

  for (const memory of activeMemories) {
    const lastAccess = memory.lastAccessedAt
      ? memory.lastAccessedAt.getTime()
      : memory.createdAt.getTime();
    const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);

    // newConfidence = confidence * (1 - decayRate/1000) ^ daysSinceLastAccess
    const decayFactor = Math.pow(1 - memory.decayRate / 1000, daysSinceAccess);
    const newConfidence = Math.round(memory.confidence * decayFactor);

    let newStatus: "active" | "decayed" | "archived" = "active";

    // Archive if last accessed more than 90 days ago AND confidence < 200
    if (now - lastAccess > NINETY_DAYS_MS && newConfidence < 200) {
      newStatus = "archived";
      archived++;
    } else if (newConfidence < 100) {
      // Decay if confidence drops below 100 (0.1)
      newStatus = "decayed";
      decayed++;
    }

    // Only update if something changed
    if (newConfidence !== memory.confidence || newStatus !== "active") {
      db.update(agentMemory)
        .set({
          confidence: Math.max(newConfidence, 0),
          status: newStatus,
          updatedAt: nowDate,
        })
        .where(eq(agentMemory.id, memory.id))
        .run();
    }
  }

  return { decayed, archived };
}
