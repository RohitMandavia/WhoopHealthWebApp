import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const userId = searchParams.get("userId") ?? callerId;

  const entries = await prisma.caffeineLog.findMany({
    where: { userId, date },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { date, mg, time, source } = await req.json();
  if (!date || !mg) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const entry = await prisma.caffeineLog.create({
    data: { userId, date, mg: Math.round(mg), time: time || null, source: source || null },
  });

  return NextResponse.json({ entry });
}
