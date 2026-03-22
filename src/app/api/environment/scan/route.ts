import { NextRequest, NextResponse } from "next/server";
import { scanEnvironment } from "@/lib/environment/scanner";
import {
  createScan,
  getLatestScan,
  getScanById,
  getArtifactCounts,
  getToolCounts,
} from "@/lib/environment/data";

/** POST: Trigger a new environment scan. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const projectDir = (body as { projectDir?: string }).projectDir || process.cwd();
  const projectId = (body as { projectId?: string }).projectId;

  const result = scanEnvironment({ projectDir });
  const scan = createScan(result, projectDir, projectId || undefined);
  const categoryCounts = getArtifactCounts(scan.id);
  const toolCounts = getToolCounts(scan.id);

  return NextResponse.json({
    scan,
    summary: {
      totalArtifacts: result.artifacts.length,
      personas: result.personas,
      categoryCounts,
      toolCounts,
      durationMs: result.durationMs,
      errors: result.errors.length,
    },
  });
}

/** GET: Return the latest scan result from cache. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const scanId = url.searchParams.get("scanId");

  let scan;
  if (scanId) {
    scan = getScanById(scanId);
  } else {
    scan = getLatestScan(projectId || undefined);
  }

  if (!scan) {
    return NextResponse.json({ scan: null, message: "No scan found" });
  }

  const categoryCounts = getArtifactCounts(scan.id);
  const toolCounts = getToolCounts(scan.id);

  return NextResponse.json({
    scan,
    summary: {
      categoryCounts,
      toolCounts,
    },
  });
}
