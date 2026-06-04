import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const userId = searchParams.get("userId") ?? callerId;

  const entry = await prisma.waterLog.findUnique({ where: { userId_date: { userId, date } } });
  return NextResponse.json({ done: entry?.done ?? false });
}

export async function PATCH(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { date, done } = await req.json() as { date: string; done: boolean };

  const entry = await prisma.waterLog.upsert({
    where: { userId_date: { userId, date } },
    update: { done },
    create: { userId, date, done },
  });

  return NextResponse.json({ done: entry.done });
}
