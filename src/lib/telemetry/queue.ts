/**
 * Telemetry batch queue — opt-in anonymized usage data.
 *
 * Events are queued in the settings table as a JSON array,
 * flushed every 5 minutes to the Supabase telemetry-ingest Edge Function.
 * Capped at 200 events to prevent unbounded growth.
 *
 * EXPLICITLY ABSENT from events: taskId, projectId, taskTitle,
 * description, result, userId, email (no PII).
 */

import { getSettingSync, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";
import { isCloudConfigured } from "@/lib/cloud/supabase-client";

const MAX_BATCH_SIZE = 200;
const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface TelemetryEvent {
  runtimeId: string;
  providerId: string;
  modelId: string;
  profileDomain?: string;
  workflowPattern?: string;
  activityType: string;
  outcomeStatus?: string;
  tokenCount?: number;
  costMicros?: number;
  durationMs?: number;
  stepCount?: number;
}

/**
 * Check if telemetry is opt-in enabled.
 */
export function isTelemetryEnabled(): boolean {
  return getSettingSync(SETTINGS_KEYS.TELEMETRY_ENABLED) === "true";
}

/**
 * Get or create the anonymous runtime ID.
 */
export function getRuntimeId(): string {
  let id = getSettingSync(SETTINGS_KEYS.TELEMETRY_RUNTIME_ID);
  if (!id) {
    id = crypto.randomUUID();
    setSetting(SETTINGS_KEYS.TELEMETRY_RUNTIME_ID, id).catch(() => {});
  }
  return id;
}

/**
 * Queue a telemetry event for batch flush.
 * No-op if telemetry is disabled.
 */
export function queueTelemetryEvent(event: TelemetryEvent): void {
  if (!isTelemetryEnabled()) return;

  const batch = loadBatch();
  if (batch.length >= MAX_BATCH_SIZE) {
    // Drop oldest events when at capacity
    batch.shift();
  }
  batch.push(event);
  saveBatch(batch);
}

/**
 * Flush the batch to the cloud telemetry endpoint.
 * Called on an interval from instrumentation.ts.
 */
export async function flushTelemetryBatch(): Promise<void> {
  if (!isTelemetryEnabled() || !isCloudConfigured()) return;

  const batch = loadBatch();
  if (batch.length === 0) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/telemetry-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ events: batch }),
    });

    if (res.ok) {
      // Clear the batch on successful flush
      saveBatch([]);
    }
  } catch {
    // Network failure — retain batch for next flush
  }
}

/**
 * Start the periodic flush timer. Call from instrumentation.ts.
 */
export function startTelemetryFlush(): void {
  // Flush once on startup
  flushTelemetryBatch().catch(() => {});
  // Then every 5 minutes
  setInterval(() => flushTelemetryBatch().catch(() => {}), FLUSH_INTERVAL_MS);
}

function loadBatch(): TelemetryEvent[] {
  try {
    const raw = getSettingSync(SETTINGS_KEYS.TELEMETRY_BATCH);
    if (!raw) return [];
    return JSON.parse(raw) as TelemetryEvent[];
  } catch {
    return [];
  }
}

function saveBatch(batch: TelemetryEvent[]): void {
  setSetting(SETTINGS_KEYS.TELEMETRY_BATCH, JSON.stringify(batch)).catch(() => {});
}
