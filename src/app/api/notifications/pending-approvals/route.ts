import { NextResponse } from "next/server";

import { listPendingApprovalPayloads } from "@/lib/notifications/actionable";

export const dynamic = "force-dynamic";

export async function GET() {
  const approvals = await listPendingApprovalPayloads();
  return NextResponse.json(approvals);
}
