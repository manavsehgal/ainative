import { NextResponse } from "next/server";
import { reloadPlugins } from "@/lib/plugins/registry";

export async function GET() {
  // Always rescan so the response reflects on-disk state.
  // Cheap: just YAML parsing of a few small files.
  const plugins = await reloadPlugins();
  return NextResponse.json({ plugins });
}
