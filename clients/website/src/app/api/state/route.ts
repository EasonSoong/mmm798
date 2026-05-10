import { NextResponse } from "next/server";
import { fetchState, fetchRecentBlocks } from "@/lib/rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  const [state, blocks] = await Promise.all([
    fetchState(),
    fetchRecentBlocks(12),
  ]);
  return NextResponse.json({ state, blocks });
}
