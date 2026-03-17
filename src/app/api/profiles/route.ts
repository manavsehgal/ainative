import { NextRequest, NextResponse } from "next/server";
import { listProfiles, createProfile, isBuiltin } from "@/lib/agents/profiles/registry";
import { sortProfilesByName } from "@/lib/agents/profiles/sort";
import { ProfileConfigSchema } from "@/lib/validators/profile";

export async function GET() {
  const profiles = sortProfilesByName(
    listProfiles().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      domain: p.domain,
      tags: p.tags,
      skillMd: p.skillMd,
      allowedTools: p.allowedTools,
      mcpServers: p.mcpServers,
      canUseToolPolicy: p.canUseToolPolicy,
      maxTurns: p.maxTurns,
      outputFormat: p.outputFormat,
      version: p.version,
      author: p.author,
      source: p.source,
      tests: p.tests,
      supportedRuntimes: p.supportedRuntimes,
      runtimeOverrides: p.runtimeOverrides,
      isBuiltin: isBuiltin(p.id),
    }))
  );

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
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

    createProfile(result.data, skillMd ?? "");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
