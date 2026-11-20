import { NextResponse } from "next/server";
import { getStoreData, resetDemoData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getStoreData();
  const status = getIntegrationStatus(data.settings);
  return NextResponse.json({ data, status });
}

export async function POST() {
  const data = await resetDemoData();
  const status = getIntegrationStatus(data.settings);
  return NextResponse.json({ data, status });
}
