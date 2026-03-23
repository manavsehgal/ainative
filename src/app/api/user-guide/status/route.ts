import { NextResponse } from "next/server";
import { getDocsLastGenerated } from "@/lib/docs/reader";
import { getSetting } from "@/lib/settings/helpers";

export async function GET() {
  const lastGenerated = getDocsLastGenerated();
  const lastVisit = await getSetting("lastPlaybookVisit");

  const hasUpdates =
    lastGenerated != null &&
    lastVisit != null &&
    new Date(lastGenerated) > new Date(lastVisit);

  return NextResponse.json({ hasUpdates });
}
