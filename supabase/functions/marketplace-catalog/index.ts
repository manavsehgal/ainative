/**
 * Marketplace Catalog Edge Function
 *
 * Returns paginated published blueprints with category filtering.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
  const offset = (page - 1) * limit;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let query = supabase
    .from("blueprints")
    .select("id, title, description, category, price_cents, success_rate, install_count, tags, created_at", { count: "exact" })
    .eq("status", "published")
    .order("install_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, count, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: "Query failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      blueprints: data ?? [],
      total: count ?? 0,
      page,
      limit,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
