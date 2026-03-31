/**
 * Auto-scan module.
 * Triggers environment scans when the last scan is stale (>5 min) or missing.
 * All functions are synchronous — scanEnvironment() and the DB layer are sync.
 */

import { getLatestScan, createScan } from "./data";
import { scanEnvironment } from "./scanner";
import type { ScanResult } from "./types";

/** Staleness threshold in milliseconds (5 minutes). */
const STALENESS_MS = 5 * 60 * 1000;

/** Returns true if no scan exists or the latest scan is older than STALENESS_MS. */
export function shouldRescan(projectId?: string): boolean {
  const latest = getLatestScan(projectId);
  if (!latest) return true;

  const scannedAt =
    latest.scannedAt instanceof Date
      ? latest.scannedAt.getTime()
      : new Date(latest.scannedAt).getTime();

  return Date.now() - scannedAt > STALENESS_MS;
}

/**
 * Ensures a fresh environment scan exists for the given project directory.
 * Runs a new scan if the latest one is stale or missing.
 * Returns the scan result if a new scan was performed, or null if already fresh.
 *
 * Errors are caught and logged — auto-scan must never block the caller.
 */
export function ensureFreshScan(
  projectDir: string,
  projectId?: string
): ScanResult | null {
  try {
    if (!shouldRescan(projectId)) return null;

    const result = scanEnvironment({ projectDir });
    createScan(result, projectDir, projectId);
    return result;
  } catch (error) {
    console.warn("Auto-scan failed (non-blocking):", error);
    return null;
  }
}
