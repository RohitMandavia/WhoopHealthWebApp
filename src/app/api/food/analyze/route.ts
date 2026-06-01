import { NextRequest, NextResponse } from "next/server";
import { analyzeFoodEntry } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const { input } = await req.json();

  if (!input?.trim()) {
    return NextResponse.json({ error: "empty_input" }, { status: 400 });
  }

  try {
    const items = await analyzeFoodEntry(input.trim());
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Food analysis error:", msg);
    return NextResponse.json({ error: "analysis_failed", detail: msg }, { status: 422 });
  }
}
