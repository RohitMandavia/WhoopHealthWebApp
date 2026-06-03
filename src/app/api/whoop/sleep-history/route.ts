import { NextRequest, NextResponse } from "next/server";
import { fetchWhoopDaily } from "@/lib/whoop";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_GOAL = 8;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId") ?? getCurrentUserId(req);
  const tz = searchParams.get("tz") ?? "UTC";

  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  // Early-out if Whoop not connected
  const whoopToken = await prisma.whoopToken.findUnique({ where: { userId } });
  if (!whoopToken) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const userStats = await prisma.userStats.findUnique({ where: { userId } });
  const goalHours = userStats?.sleepGoalHours ?? DEFAULT_GOAL;

  // Build last 7 calendar dates using the 4am reset
  const now = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString("en-CA"));
  }

  const results = await Promise.allSettled(
    dates.map((date) => fetchWhoopDaily(date, userId, tz))
  );

  const days = dates.map((date, i) => {
    const r = results[i];
    const sleepHours = r.status === "fulfilled" ? (r.value.sleep?.durationHours ?? null) : null;
    return { date, sleepHours };
  });

  const daysWithData = days.filter((d) => d.sleepHours != null);
  const avgHours =
    daysWithData.length > 0
      ? Math.round((daysWithData.reduce((s, d) => s + (d.sleepHours ?? 0), 0) / daysWithData.length) * 10) / 10
      : null;

  // Surplus nights offset deficit nights; only clamp the final sum to 0
  const rawDebt = daysWithData.reduce((s, d) => s + (goalHours - (d.sleepHours ?? goalHours)), 0);
  const debtHours = Math.max(0, Math.round(rawDebt * 10) / 10);

  return NextResponse.json({ goalHours, days, avgHours, debtHours });
}
