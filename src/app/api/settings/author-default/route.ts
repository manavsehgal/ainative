import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const info = os.userInfo();
  return NextResponse.json({ author: info.username });
}
