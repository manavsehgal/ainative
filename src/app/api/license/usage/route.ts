import { NextResponse } from "next/server";
import { licenseManager } from "@/lib/license/manager";
import { getContextVersionCount, getActiveScheduleCount } from "@/lib/license/limit-queries";
import { getAllExecutions } from "@/lib/agents/execution-manager";
import { db } from "@/lib/db";
import { agentMemory } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

/**
 * GET /api/license/usage
 * Returns current usage counts and limits for the subscription UI.
 */
export async function GET() {
  // Find the profile with the most memories for the usage display
  const topProfile = db
    .select({
      profileId: agentMemory.profileId,
      count: sql<number>`count(*)`,
    })
    .from(agentMemory)
    .where(eq(agentMemory.status, "active"))
    .groupBy(agentMemory.profileId)
    .orderBy(desc(sql`count(*)`))
    .limit(1)
    .get();

  const memoryCount = topProfile?.count ?? 0;

  // Find the profile with the most context versions
  // Use the same top profile for consistency
  const contextCount = topProfile?.profileId
    ? getContextVersionCount(topProfile.profileId)
    : 0;

  const scheduleCount = getActiveScheduleCount();
  const parallelCount = getAllExecutions().size;

  const limits = {
    agentMemories: licenseManager.getLimit("agentMemories"),
    contextVersions: licenseManager.getLimit("contextVersions"),
    activeSchedules: licenseManager.getLimit("activeSchedules"),
    parallelWorkflows: licenseManager.getLimit("parallelWorkflows"),
  };

  return NextResponse.json({
    agentMemories: {
      current: memoryCount,
      limit: limits.agentMemories === Infinity ? -1 : limits.agentMemories,
    },
    contextVersions: {
      current: contextCount,
      limit: limits.contextVersions === Infinity ? -1 : limits.contextVersions,
    },
    activeSchedules: {
      current: scheduleCount,
      limit: limits.activeSchedules === Infinity ? -1 : limits.activeSchedules,
    },
    parallelWorkflows: {
      current: parallelCount,
      limit: limits.parallelWorkflows === Infinity ? -1 : limits.parallelWorkflows,
    },
  });
}
