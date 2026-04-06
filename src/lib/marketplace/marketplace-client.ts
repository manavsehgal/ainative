/**
 * Marketplace client — Supabase CRUD for blueprints.
 * All reads go through the marketplace-catalog Edge Function.
 * Writes go directly to Supabase with RLS.
 */

import { getSupabaseClient, isCloudConfigured } from "@/lib/cloud/supabase-client";

export interface MarketplaceBlueprint {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price_cents: number;
  success_rate: number;
  install_count: number;
  tags: string[];
  created_at: string;
}

export interface MarketplaceCatalogResult {
  blueprints: MarketplaceBlueprint[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Browse published blueprints (available to all tiers).
 */
export async function browseBlueprints(
  page: number = 1,
  category?: string
): Promise<MarketplaceCatalogResult> {
  if (!isCloudConfigured()) {
    return { blueprints: [], total: 0, page, limit: 20 };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const params = new URLSearchParams({ page: String(page) });
  if (category) params.set("category", category);

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/marketplace-catalog?${params}`,
      { headers: { Authorization: `Bearer ${anonKey}` } }
    );
    if (!res.ok) return { blueprints: [], total: 0, page, limit: 20 };
    return await res.json();
  } catch {
    return { blueprints: [], total: 0, page, limit: 20 };
  }
}

/**
 * Import a blueprint into local workflows (Solo+ tier).
 */
export async function importBlueprint(
  blueprintId: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  const { data, error } = await supabase
    .from("blueprints")
    .select("content")
    .eq("id", blueprintId)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Blueprint not found" };
  }

  return { success: true, content: data.content };
}

/**
 * Publish a local workflow as a marketplace blueprint (Operator+ tier).
 */
export async function publishBlueprint(params: {
  title: string;
  description: string;
  category: string;
  content: string;
  tags: string[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  const { data, error } = await supabase
    .from("blueprints")
    .insert({
      title: params.title,
      description: params.description,
      category: params.category,
      content: params.content,
      tags: params.tags,
      status: "published",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}
