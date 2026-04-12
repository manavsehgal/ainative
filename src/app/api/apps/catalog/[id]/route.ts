import { type NextRequest, NextResponse } from "next/server";
import { getAppCatalogEntry } from "@/lib/apps/service";
import { getAppBundle } from "@/lib/apps/registry";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = getAppCatalogEntry(id);

  if (!entry) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  const bundle = getAppBundle(id);
  const whatsIncluded = bundle
    ? {
        tables: bundle.tables.map((t) => t.name),
        schedules: bundle.schedules.map((s) => s.name),
        profiles: bundle.profiles.map((p) => p.label),
        blueprints: bundle.blueprints.map((b) => b.label),
        triggers: bundle.triggers?.map((t) => t.name) ?? [],
        savedViews: bundle.savedViews?.map((v) => v.name) ?? [],
        envVars: bundle.envVars?.map((e) => e.name) ?? [],
        setupChecklist: bundle.setupChecklist,
      }
    : null;

  return NextResponse.json({ app: entry, whatsIncluded });
}
