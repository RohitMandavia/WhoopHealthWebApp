import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId") ?? callerId;

  // Return last 90 days of entries
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().split("T")[0];

  const entries = await prisma.weightEntry.findMany({
    where: { userId, date: { gte: sinceStr } },
    orderBy: { date: "asc" },
    select: { date: true, weightLbs: true },
  });

  return NextResponse.json({ entries });
}

export async function PATCH(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { date, weightLbs } = await req.json() as { date: string; weightLbs: number | null };

  if (weightLbs == null) {
    await prisma.weightEntry.deleteMany({ where: { userId, date } });
    return NextResponse.json({ weightLbs: null });
  }

  const entry = await prisma.weightEntry.upsert({
    where: { userId_date: { userId, date } },
    update: { weightLbs },
    create: { userId, date, weightLbs },
  });

  return NextResponse.json({ weightLbs: entry.weightLbs });
}
