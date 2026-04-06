/**
 * Telemetry Ingest Edge Function
 *
 * Receives batched telemetry events and inserts them.
 * Validates that no PII fields are present.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PII_FIELDS = ["taskId", "projectId", "taskTitle", "description", "result", "userId", "email"];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { events } = await req.json();
  if (!Array.isArray(events) || events.length === 0) {
    return new Response(
      JSON.stringify({ error: "events array required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Reject batch if any event contains PII fields
  for (const event of events) {
    for (const field of PII_FIELDS) {
      if (field in event) {
        return new Response(
          JSON.stringify({ error: `PII field '${field}' not allowed in telemetry` }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const rows = events.map((e: Record<string, unknown>) => ({
    runtime_id: e.runtimeId,
    provider_id: e.providerId,
    model_id: e.modelId,
    profile_domain: e.profileDomain ?? null,
    workflow_pattern: e.workflowPattern ?? null,
    activity_type: e.activityType,
    outcome_status: e.outcomeStatus ?? null,
    token_count: e.tokenCount ?? 0,
    cost_micros: e.costMicros ?? 0,
    duration_ms: e.durationMs ?? 0,
    step_count: e.stepCount ?? 1,
  }));

  const { error } = await supabase.from("telemetry_events").insert(rows);

  if (error) {
    return new Response(
      JSON.stringify({ error: "Insert failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ inserted: rows.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
