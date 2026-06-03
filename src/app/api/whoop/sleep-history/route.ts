import { NextRequest, NextResponse } from "next/server";
import { fetchSleepHistory } from "@/lib/whoop";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_GOAL = 8;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId") ?? getCurrentUserId(req);
  const tz = searchParams.get("tz") ?? "UTC";

  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const userStats = await prisma.userStats.findUnique({ where: { userId } });
  const goalHours = userStats?.sleepGoalHours ?? DEFAULT_GOAL;

  try {
    const days = await fetchSleepHistory(userId, tz, 7);

    const daysWithData = days.filter((d) => d.sleepHours != null);
    const avgHours =
      daysWithData.length > 0
        ? Math.round((daysWithData.reduce((s, d) => s + (d.sleepHours ?? 0), 0) / daysWithData.length) * 10) / 10
        : null;

    // Surplus nights offset deficit nights; only clamp the final sum to 0
    const rawDebt = daysWithData.reduce((s, d) => s + (goalHours - (d.sleepHours ?? goalHours)), 0);
    const debtHours = Math.max(0, Math.round(rawDebt * 10) / 10);

    return NextResponse.json({ goalHours, days, avgHours, debtHours });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "WHOOP_NOT_CONNECTED") {
      return NextResponse.json({ error: "not_connected" }, { status: 401 });
    }
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
