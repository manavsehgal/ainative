import { NextResponse } from "next/server";
import { reloadPlugins } from "@/lib/plugins/registry";

export async function POST() {
  const plugins = reloadPlugins();
  return NextResponse.json({
    loaded: plugins.filter((p) => p.status === "loaded").map((p) => ({
      id: p.id,
      profiles: p.profiles,
      blueprints: p.blueprints,
      tables: p.tables,
    })),
    disabled: plugins.filter((p) => p.status === "disabled").map((p) => ({
      id: p.id,
      error: p.error,
    })),
  });
}
