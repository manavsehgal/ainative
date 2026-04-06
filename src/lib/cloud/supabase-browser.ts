"use client";

/**
 * Browser-side Supabase client with session persistence.
 *
 * Used for auth flows (magic link sign-in) and authenticated operations
 * (Storage uploads for cloud sync). The server-side client in
 * supabase-client.ts is for server components and API routes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://yznantjbmacbllhcyzwc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bmFudGpibWFjYmxsaGN5endjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MDg1ODMsImV4cCI6MjA4ODA4NDU4M30.i-P7MXpR1_emBjhUkzbFeSX7fgjgPDv90_wkqF7sW3Y";

let browserClient: SupabaseClient | null = null;

/**
 * Get the browser-side Supabase client with session persistence.
 * Sessions are stored in localStorage and auto-refreshed.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  browserClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storageKey: "stagent-auth",
    },
  });

  return browserClient;
}
