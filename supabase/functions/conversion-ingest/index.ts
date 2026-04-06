/**
 * Conversion Ingest Edge Function
 *
 * Receives conversion funnel events and stores them.
 * No PII — only event_type, session_id, source, metadata, timestamp.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { eventType, sessionId, source, metadata } = await req.json();

  if (!eventType || !sessionId) {
    return new Response(
      JSON.stringify({ error: "eventType and sessionId required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const validTypes = ["banner_impression", "banner_click", "checkout_started", "checkout_completed", "limit_hit"];
  if (!validTypes.includes(eventType)) {
    return new Response(
      JSON.stringify({ error: `Invalid event type: ${eventType}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Create table on first use (idempotent)
  await supabase.rpc("exec_sql", {
    query: `CREATE TABLE IF NOT EXISTS conversion_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type TEXT NOT NULL,
      session_id TEXT NOT NULL,
      source TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  }).catch(() => { /* table may already exist */ });

  const { error } = await supabase
    .from("conversion_events")
    .insert({
      event_type: eventType,
      session_id: sessionId,
      source: source ?? null,
      metadata: metadata ?? null,
    });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Insert failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ tracked: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
