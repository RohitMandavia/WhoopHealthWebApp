import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { id: habitId } = await params;
  const { date, done } = await req.json() as { date: string; done: boolean };

  const log = await prisma.habitLog.upsert({
    where: { habitId_date: { habitId, date } },
    update: { done },
    create: { habitId, userId, date, done },
  });

  return NextResponse.json({ done: log.done });
}
