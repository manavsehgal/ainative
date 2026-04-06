"use client";

/**
 * Browser-side Supabase client with session persistence.
 *
 * Used for auth flows (magic link sign-in) and authenticated operations
 * (Storage uploads for cloud sync). The server-side client in
 * supabase-client.ts is for server components and API routes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/cloud/supabase-client";

let browserClient: SupabaseClient | null = null;

/**
 * Get the browser-side Supabase client with session persistence.
 * Sessions are stored in localStorage and auto-refreshed.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storageKey: "stagent-auth",
    },
  });

  return browserClient;
}
