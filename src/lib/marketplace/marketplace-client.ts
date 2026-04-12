/**
 * Marketplace client — Supabase CRUD for blueprints.
 * All reads go through the marketplace-catalog Edge Function.
 * Writes go directly to Supabase with RLS.
 */

import { getSupabaseClient, isCloudConfigured, getSupabaseUrl, getSupabaseAnonKey } from "@/lib/cloud/supabase-client";

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

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

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

// ── App publishing ──────────────────────────────────────────────────

export interface AppPackage {
  id: string;
  app_id: string;
  version: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  pricing_type: "free" | "paid";
  price_cents: number;
  checksum_sha256: string;
  storage_url: string;
  icon_url: string | null;
  readme: string | null;
  manifest_json: string;
  trust_level: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PublishAppParams {
  appId: string;
  version: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  pricingType: "free" | "paid";
  priceCents?: number;
  readme?: string;
  manifestJson: string;
  checksumSha256: string;
  sapArchive: Uint8Array;
}

/**
 * Upload a .sap archive to Supabase Storage.
 */
export async function uploadAppArchive(
  appId: string,
  version: string,
  archive: Uint8Array,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  const path = `apps/${appId}/${version}/app.sap`;
  const { error } = await supabase.storage
    .from("stagent-marketplace")
    .upload(path, archive, {
      contentType: "application/gzip",
      upsert: true,
    });

  if (error) return { success: false, error: error.message };
  return { success: true, url: path };
}

/**
 * Publish an app to the marketplace registry (Operator+ tier).
 */
export async function publishApp(
  params: PublishAppParams,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  // Upload archive first
  const upload = await uploadAppArchive(
    params.appId,
    params.version,
    params.sapArchive,
  );
  if (!upload.success) {
    return { success: false, error: `Archive upload failed: ${upload.error}` };
  }

  // Register metadata
  const { data, error } = await supabase
    .from("app_packages")
    .insert({
      app_id: params.appId,
      version: params.version,
      title: params.title,
      description: params.description,
      category: params.category,
      tags: params.tags,
      pricing_type: params.pricingType,
      price_cents: params.priceCents ?? 0,
      checksum_sha256: params.checksumSha256,
      storage_url: upload.url,
      readme: params.readme ?? null,
      manifest_json: params.manifestJson,
      trust_level: "community",
      status: "published",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

/**
 * Update an existing app listing's metadata.
 */
export async function updateAppListing(
  appId: string,
  updates: Partial<{
    title: string;
    description: string;
    category: string;
    tags: string[];
    readme: string;
    pricingType: "free" | "paid";
    priceCents: number;
  }>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  const updatePayload: Record<string, unknown> = {};
  if (updates.title !== undefined) updatePayload.title = updates.title;
  if (updates.description !== undefined) updatePayload.description = updates.description;
  if (updates.category !== undefined) updatePayload.category = updates.category;
  if (updates.tags !== undefined) updatePayload.tags = updates.tags;
  if (updates.readme !== undefined) updatePayload.readme = updates.readme;
  if (updates.pricingType !== undefined) updatePayload.pricing_type = updates.pricingType;
  if (updates.priceCents !== undefined) updatePayload.price_cents = updates.priceCents;
  updatePayload.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("app_packages")
    .update(updatePayload)
    .eq("app_id", appId)
    .eq("status", "published");

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Unpublish an app from the marketplace.
 */
export async function unpublishApp(
  appId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  const { error } = await supabase
    .from("app_packages")
    .update({ status: "unpublished", updated_at: new Date().toISOString() })
    .eq("app_id", appId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
