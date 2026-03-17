import { NextResponse } from "next/server";
import {
  getPricingRegistrySnapshot,
  refreshPricingRegistry,
} from "@/lib/usage/pricing-registry";

export async function GET() {
  const snapshot = await getPricingRegistrySnapshot();
  return NextResponse.json(snapshot);
}

export async function POST() {
  const snapshot = await refreshPricingRegistry();
  return NextResponse.json(snapshot);
}
