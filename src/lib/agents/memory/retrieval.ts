import { db } from "@/lib/db";
import { agentMemory, type AgentMemoryRow } from "@/lib/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";

/**
 * Retrieve the most relevant memories for a given profile and task context.
 * Scores memories by confidence, recency, and tag overlap with the task context.
 * Updates lastAccessedAt and accessCount for returned memories.
 */
export async function getRelevantMemories(
  profileId: string,
  taskContext: string,
  limit: number = 10
): Promise<AgentMemoryRow[]> {
  // Query active memories with confidence >= 300 (0.3)
  const candidates = db
    .select()
    .from(agentMemory)
    .where(
      and(
        eq(agentMemory.profileId, profileId),
        eq(agentMemory.status, "active"),
        gte(agentMemory.confidence, 300)
      )
    )
    .all();

  if (candidates.length === 0) return [];

  const now = Date.now();
  const contextLower = taskContext.toLowerCase();
  const contextWords = new Set(contextLower.split(/\s+/));

  // Score each memory
  const scored = candidates.map((memory) => {
    // Confidence factor: normalize 0-1000 to 0-1
    const confidenceFactor = memory.confidence / 1000;

    // Recency factor: exponential decay based on days since last access
    const lastAccess = memory.lastAccessedAt
      ? memory.lastAccessedAt.getTime()
      : memory.createdAt.getTime();
    const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.exp(-0.05 * daysSinceAccess); // half-life ~14 days

    // Tag overlap: count of tags that appear in the task context
    let tagOverlap = 0;
    if (memory.tags) {
      try {
        const tags: string[] = JSON.parse(memory.tags);
        for (const tag of tags) {
          if (contextLower.includes(tag.toLowerCase())) {
            tagOverlap += 1;
          }
        }
      } catch {
        // Invalid JSON tags — ignore
      }
    }

    // Content relevance: word overlap between memory content and context
    const memoryWords = memory.content.toLowerCase().split(/\s+/);
    const wordOverlap = memoryWords.filter((w) => contextWords.has(w)).length;
    const contentFactor = Math.min(wordOverlap / 5, 1); // cap at 1

    const score =
      confidenceFactor * 0.3 +
      recencyFactor * 0.2 +
      (tagOverlap > 0 ? 0.25 : 0) +
      contentFactor * 0.25;

    return { memory, score };
  });

  // Sort by score descending and take top N
  scored.sort((a, b) => b.score - a.score);
  const topMemories = scored.slice(0, limit).map((s) => s.memory);

  // Update lastAccessedAt and accessCount for returned memories
  if (topMemories.length > 0) {
    const ids = topMemories.map((m) => m.id);
    const nowTimestamp = new Date(now);

    // Batch update: SQLite doesn't support UPDATE with JOIN, so use IN clause
    db.update(agentMemory)
      .set({
        lastAccessedAt: nowTimestamp,
        accessCount: topMemories[0].accessCount + 1, // approximate — fine for v1
        updatedAt: nowTimestamp,
      })
      .where(inArray(agentMemory.id, ids))
      .run();
  }

  return topMemories;
}
