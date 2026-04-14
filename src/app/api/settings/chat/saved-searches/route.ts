import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { z } from "zod";

/**
 * GET/PUT `/api/settings/chat/saved-searches` — per-user saved filter
 * combinations for chat popovers and the ⌘K palette. Storage mirrors the
 * pins route: a single JSON blob under `chat.savedSearches` in the
 * settings key-value table.
 *
 * Design notes:
 *  - Full-list replacement on PUT. Client is source of truth — avoids
 *    concurrent-mutation bookkeeping for a single-user local product.
 *  - PUT dedupes by `id` with last-write-wins on rapid double-saves.
 *  - Malformed stored value (manual edit, schema drift) degrades to `[]`
 *    rather than erroring — the user can re-save.
 */

const SETTINGS_KEY = "chat.savedSearches";

// Surfaces map to popover tabs + list routes. Extend as new popover
// surfaces are added (table, schedule, etc.).
const SURFACES = [
  "task",
  "project",
  "workflow",
  "document",
  "skill",
  "profile",
] as const;

const SavedSearchSchema = z.object({
  id: z.string().min(1),
  surface: z.enum(SURFACES),
  label: z.string().min(1).max(120),
  filterInput: z.string().max(500),
  createdAt: z.string(), // ISO 8601
});

const PayloadSchema = z.object({
  searches: z.array(SavedSearchSchema),
});

export type SavedSearch = z.infer<typeof SavedSearchSchema>;

export async function GET() {
  const raw = await getSetting(SETTINGS_KEY);
  if (!raw) return NextResponse.json({ searches: [] });
  try {
    const parsed = PayloadSchema.parse(JSON.parse(raw));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ searches: [] });
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const result = PayloadSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "invalid searches payload", issues: result.error.issues },
      { status: 400 }
    );
  }

  const byId = new Map<string, SavedSearch>();
  for (const s of result.data.searches) byId.set(s.id, s);
  const deduped = Array.from(byId.values());

  await setSetting(SETTINGS_KEY, JSON.stringify({ searches: deduped }));
  return NextResponse.json({ searches: deduped });
}
