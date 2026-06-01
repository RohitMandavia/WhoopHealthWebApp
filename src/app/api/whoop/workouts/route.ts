import { NextRequest, NextResponse } from "next/server";
import { fetchWhoopDaily } from "@/lib/whoop";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const userId = searchParams.get("userId") ?? getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  try {
    const { workouts } = await fetchWhoopDaily(date, userId);
    return NextResponse.json({ workouts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "WHOOP_NOT_CONNECTED") {
      return NextResponse.json({ error: "not_connected" }, { status: 401 });
    }
    return NextResponse.json({ error: "fetch_failed", detail: msg }, { status: 500 });
  }
}
