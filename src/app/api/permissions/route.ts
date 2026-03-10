import { NextRequest, NextResponse } from "next/server";
import {
  getAllowedPermissions,
  addAllowedPermission,
  removeAllowedPermission,
} from "@/lib/settings/permissions";
import { z } from "zod";

const patternSchema = z.object({
  pattern: z.string().min(1),
});

export async function GET() {
  const permissions = await getAllowedPermissions();
  return NextResponse.json({ permissions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = patternSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "pattern (string) is required" },
      { status: 400 }
    );
  }

  await addAllowedPermission(parsed.data.pattern);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const parsed = patternSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "pattern (string) is required" },
      { status: 400 }
    );
  }

  await removeAllowedPermission(parsed.data.pattern);
  return NextResponse.json({ success: true });
}
