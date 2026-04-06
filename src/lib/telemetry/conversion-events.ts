/**
 * Conversion funnel tracking — lightweight, anonymous event tracking
 * for Community→Premium conversion optimization.
 *
 * Events: banner_impression, banner_click, checkout_started,
 * checkout_completed, limit_hit
 *
 * Fire-and-forget — never blocks user actions. No PII.
 * No-op if Supabase is not configured.
 */

import { isCloudConfigured } from "@/lib/cloud/supabase-client";
import { getSettingSync, setSetting } from "@/lib/settings/helpers";

const SESSION_KEY = "conversion.sessionId";

export type ConversionEventType =
  | "banner_impression"
  | "banner_click"
  | "checkout_started"
  | "checkout_completed"
  | "limit_hit";

/**
 * Get or create an anonymous session ID for conversion tracking.
 * Stored in settings, not tied to any user identity.
 */
function getSessionId(): string {
  let id = getSettingSync(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    setSetting(SESSION_KEY, id).catch(() => {});
  }
  return id;
}

/**
 * Track a conversion funnel event. Fire-and-forget.
 *
 * @param eventType - The event type
 * @param source - Where the event originated (e.g., "memory_banner", "schedule_gate")
 * @param metadata - Optional additional context
 */
export function trackConversionEvent(
  eventType: ConversionEventType,
  source?: string,
  metadata?: Record<string, unknown>
): void {
  if (!isCloudConfigured()) return;

  const sessionId = getSessionId();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return;

  // Fire-and-forget — don't await, don't block
  fetch(`${supabaseUrl}/functions/v1/conversion-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      eventType,
      sessionId,
      source: source ?? null,
      metadata: metadata ?? null,
    }),
  }).catch(() => {
    // Silently ignore — conversion tracking is non-critical
  });
}
