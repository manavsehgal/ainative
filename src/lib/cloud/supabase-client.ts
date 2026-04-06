/**
 * Supabase client singleton for cloud features.
 *
 * Lazy-initialized — returns null if environment variables are not set.
 * This allows all cloud features to gracefully degrade when Supabase
 * is not configured (Community Edition default).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let initialized = false;

/**
 * Get the Supabase client, or null if not configured.
 * Safe to call repeatedly — creates the client only once.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (initialized) return client;
  initialized = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Server-side — no browser session
    },
  });

  return client;
}

/**
 * Check if Supabase cloud backend is configured.
 */
export function isCloudConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
