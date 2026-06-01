import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const entry = await prisma.stepEntry.findUnique({ where: { userId_date: { userId, date } } });
  return NextResponse.json({ steps: entry?.steps ?? null });
}

export async function PATCH(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { date, steps } = await req.json() as { date: string; steps: number | null };

  if (steps == null) {
    await prisma.stepEntry.deleteMany({ where: { userId, date } });
    return NextResponse.json({ steps: null });
  }

  const entry = await prisma.stepEntry.upsert({
    where: { userId_date: { userId, date } },
    update: { steps },
    create: { userId, date, steps },
  });
  return NextResponse.json({ steps: entry.steps });
}
