import { NextResponse } from "next/server";
import {
  fetchState,
  fetchRecentBlocks,
  fetchLeaderboard,
  fetchHashrateSeries,
} from "@/lib/rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  const [state, blocks, leaderboard, series] = await Promise.all([
    fetchState(),
    fetchRecentBlocks(12),
    fetchLeaderboard(200, 20),
    fetchHashrateSeries(200, 30),
  ]);
  return NextResponse.json({ state, blocks, leaderboard, series });
}
