import { NextResponse } from "next/server";
import { getStoreData, resetDemoData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET() {
  const data = await getStoreData();
  const status = getIntegrationStatus(data.settings);
  return NextResponse.json({ data, status }, { headers: NO_STORE_HEADERS });
}

export async function POST() {
  const data = await resetDemoData();
  const status = getIntegrationStatus(data.settings);
  return NextResponse.json({ data, status }, { headers: NO_STORE_HEADERS });
}
