import { NextRequest, NextResponse } from "next/server";
import { createBlueprint } from "@/lib/workflows/blueprints/registry";

/**
 * POST /api/blueprints/import
 *
 * Import a blueprint from a GitHub URL pointing to a YAML file.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const rawUrl = toRawGitHubUrl(url);
    if (!rawUrl) {
      return NextResponse.json(
        { error: "Only GitHub URLs are supported" },
        { status: 400 }
      );
    }

    const res = await fetch(rawUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch blueprint: ${res.status}` },
        { status: 400 }
      );
    }

    const yamlContent = await res.text();
    const blueprint = createBlueprint(yamlContent);

    return NextResponse.json(
      { ok: true, id: blueprint.id, name: blueprint.name },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function toRawGitHubUrl(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname === "raw.githubusercontent.com") {
      return url;
    }

    if (u.hostname !== "github.com") return null;

    const match = u.pathname.match(
      /^\/([^/]+)\/([^/]+)\/(tree|blob)\/([^/]+)\/(.+)/
    );
    if (match) {
      const [, owner, repo, , branch, filePath] = match;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    }

    return null;
  } catch {
    return null;
  }
}
