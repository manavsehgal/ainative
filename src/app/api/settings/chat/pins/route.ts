import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { z } from "zod";

/**
 * GET/PUT `/api/settings/chat/pins` — per-user pinned entities for chat
 * mention popover. Storage is a single JSON blob under the
 * `chat.pinnedEntries` key in the `settings` key-value table.
 *
 * Design notes:
 *  - No server-side validation that `entityId` exists in its table.
 *    Pins are weakly referenced; popover filter just won't match if the
 *    entity has been deleted. Cheaper than maintaining referential integrity
 *    via cascading deletes, and stale pins can be removed by the user on next
 *    un-pin. Trade-off accepted.
 *  - PUT replaces the entire list (client is source of truth). Read-modify-
 *    write happens on the client to avoid concurrent-mutation issues, which
 *    for single-user local usage is a non-issue.
 */

const SETTINGS_KEY = "chat.pinnedEntries";

// Entity types recognized by entities/search — mirrored here to constrain
// what can be pinned. Add new types as they become available.
const ENTITY_TYPES = [
  "task",
  "project",
  "workflow",
  "document",
  "schedule",
  "table",
  "profile",
] as const;

// We denormalize `label`, `description`, and `status` into the pin record
// so the Pinned group renders standalone, independent of whether the item
// appears in the current `entities/search` response window (top-20 per type).
// Trade-off: labels may go stale if the underlying entity is renamed.
// Acceptable for a UX affordance — selecting the pin still uses the canonical
// id, and the user can un-pin/re-pin to refresh. Mitigation is lazy refresh
// on next popover open (future enhancement).
const PinnedEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(ENTITY_TYPES),
  label: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  pinnedAt: z.string(), // ISO 8601
});

const PinsPayloadSchema = z.object({
  pins: z.array(PinnedEntrySchema),
});

export type PinnedEntry = z.infer<typeof PinnedEntrySchema>;

export async function GET() {
  const raw = await getSetting(SETTINGS_KEY);
  if (!raw) return NextResponse.json({ pins: [] });
  try {
    const parsed = PinsPayloadSchema.parse(JSON.parse(raw));
    return NextResponse.json(parsed);
  } catch {
    // Malformed stored value (manual edit, version mismatch) — recover by
    // returning an empty list rather than erroring. The user can re-pin.
    return NextResponse.json({ pins: [] });
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const result = PinsPayloadSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "invalid pins payload", issues: result.error.issues },
      { status: 400 }
    );
  }

  // De-dup by id — client may send the same pin twice on rapid clicks.
  // Last write wins for pinnedAt.
  const byId = new Map<string, PinnedEntry>();
  for (const pin of result.data.pins) byId.set(pin.id, pin);
  const deduped = Array.from(byId.values());

  await setSetting(SETTINGS_KEY, JSON.stringify({ pins: deduped }));
  return NextResponse.json({ pins: deduped });
}
