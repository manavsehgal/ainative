import { NextResponse } from "next/server";
import { z } from "zod";
import {
  scaffoldPluginSpec,
  PluginSpecAlreadyExistsError,
  PluginSpecInvalidIdError,
  PluginSpecWriteError,
} from "@/lib/chat/tools/plugin-spec-tools";

const ToolStubSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().min(1),
  inputSchema: z.unknown().optional(),
});

const CreatePluginSpecInputSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*[a-z0-9]$/),
  name: z.string().min(1),
  description: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  transport: z.enum(["stdio", "inprocess"]).default("stdio"),
  language: z.enum(["python", "node"]).default("python"),
  tools: z.array(ToolStubSchema).min(1),
});

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON body", code: "bad_request" },
      { status: 400 }
    );
  }

  const parsed = CreatePluginSpecInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.map((i) => i.message).join("; "),
        code: "validation_failed",
      },
      { status: 400 }
    );
  }

  try {
    const result = scaffoldPluginSpec(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PluginSpecInvalidIdError) {
      return NextResponse.json(
        { error: err.message, code: "invalid_id" },
        { status: 400 }
      );
    }
    if (err instanceof PluginSpecAlreadyExistsError) {
      return NextResponse.json(
        { error: err.message, code: "already_exists" },
        { status: 409 }
      );
    }
    if (err instanceof PluginSpecWriteError) {
      return NextResponse.json(
        { error: err.message, code: "write_failed" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "internal_error",
      },
      { status: 500 }
    );
  }
}
