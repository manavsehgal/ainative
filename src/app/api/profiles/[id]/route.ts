import { NextRequest, NextResponse } from "next/server";
import {
  getProfile,
  updateProfile,
  deleteProfile,
  isBuiltin,
} from "@/lib/agents/profiles/registry";
import { ProfileConfigSchema } from "@/lib/validators/profile";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = getProfile(id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...profile,
    isBuiltin: isBuiltin(id),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isBuiltin(id)) {
    return NextResponse.json(
      { error: "Cannot modify built-in profiles" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { skillMd, ...configFields } = body;

    const result = ProfileConfigSchema.safeParse(configFields);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    updateProfile(id, result.data, skillMd ?? "");
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isBuiltin(id)) {
    return NextResponse.json(
      { error: "Cannot delete built-in profiles" },
      { status: 403 }
    );
  }

  try {
    deleteProfile(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
