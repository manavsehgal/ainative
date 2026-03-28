import { db } from "@/lib/db";
import { profileTestResults } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ProfileTestReport } from "@/lib/agents/profiles/test-types";
import { randomUUID } from "crypto";

export function saveProfileTestReport(report: ProfileTestReport): void {
  // Upsert: delete old result for same profile+runtime, then insert
  db.delete(profileTestResults)
    .where(
      and(
        eq(profileTestResults.profileId, report.profileId),
        eq(profileTestResults.runtimeId, report.runtimeId)
      )
    )
    .run();

  db.insert(profileTestResults)
    .values({
      id: randomUUID(),
      profileId: report.profileId,
      runtimeId: report.runtimeId,
      reportJson: JSON.stringify(report),
      totalPassed: report.totalPassed,
      totalFailed: report.totalFailed,
      createdAt: new Date(),
    })
    .run();
}

export function getLatestProfileTestReport(
  profileId: string,
  runtimeId: string
): ProfileTestReport | null {
  const row = db
    .select()
    .from(profileTestResults)
    .where(
      and(
        eq(profileTestResults.profileId, profileId),
        eq(profileTestResults.runtimeId, runtimeId)
      )
    )
    .get();

  if (!row) return null;
  return JSON.parse(row.reportJson) as ProfileTestReport;
}
