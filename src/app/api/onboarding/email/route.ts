import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/cloud/supabase-client";

const emailSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/onboarding/email
 * Creates a Supabase Auth user via magic link.
 * Fire-and-forget — does not block any local functionality.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = emailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    // Cloud not configured — silently succeed
    return NextResponse.json({ ok: true });
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:3000"}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to cloud service" },
      { status: 502 }
    );
  }
}
