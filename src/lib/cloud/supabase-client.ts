/**
 * Supabase client singleton for cloud features.
 *
 * Connects to the Stagent cloud backend for license validation,
 * marketplace, telemetry, and cloud sync. The anon key is safe to
 * embed — Row Level Security policies protect all data.
 *
 * Env vars override the defaults (for self-hosted or development).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Production Stagent cloud backend — safe to embed (anon key, RLS-protected) */
const DEFAULT_SUPABASE_URL = "https://yznantjbmacbllhcyzwc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bmFudGpibWFjYmxsaGN5endjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MDg1ODMsImV4cCI6MjA4ODA4NDU4M30.i-P7MXpR1_emBjhUkzbFeSX7fgjgPDv90_wkqF7sW3Y";

/** Resolved Supabase URL (env override or production default) */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

/** Resolved Supabase anon key (env override or production default) */
export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
}

let client: SupabaseClient | null = null;
let initialized = false;

/**
 * Get the Supabase client. Uses the production Stagent backend by default.
 * Override with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * env vars for self-hosted or development setups.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (initialized) return client;
  initialized = true;

  client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Server-side — no browser session
    },
  });

  return client;
}

/**
 * Cloud is always configured — defaults to Stagent production backend.
 * Returns false only if explicitly disabled via STAGENT_CLOUD_DISABLED=true.
 */
export function isCloudConfigured(): boolean {
  return process.env.STAGENT_CLOUD_DISABLED !== "true";
}
