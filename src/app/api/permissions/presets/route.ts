import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPreset,
  getActivePresets,
  applyPreset,
  removePreset,
  PRESETS,
} from "@/lib/settings/permission-presets";

const presetSchema = z.object({
  presetId: z.string().min(1),
});

/**
 * GET /api/permissions/presets — list all presets with their active status.
 */
export async function GET() {
  const activeIds = await getActivePresets();
  const activeSet = new Set(activeIds);

  const presets = PRESETS.map((p) => ({
    ...p,
    active: activeSet.has(p.id),
  }));

  return NextResponse.json({ presets });
}

/**
 * POST /api/permissions/presets — enable a preset (adds all its patterns).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = presetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "presetId (string) is required" },
      { status: 400 }
    );
  }

  const preset = getPreset(parsed.data.presetId);
  if (!preset) {
    return NextResponse.json(
      { error: `Unknown preset: ${parsed.data.presetId}` },
      { status: 404 }
    );
  }

  await applyPreset(parsed.data.presetId);
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/permissions/presets — disable a preset (removes unique patterns).
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const parsed = presetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "presetId (string) is required" },
      { status: 400 }
    );
  }

  const preset = getPreset(parsed.data.presetId);
  if (!preset) {
    return NextResponse.json(
      { error: `Unknown preset: ${parsed.data.presetId}` },
      { status: 404 }
    );
  }

  await removePreset(parsed.data.presetId);
  return NextResponse.json({ success: true });
}
