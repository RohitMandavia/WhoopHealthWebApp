import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const exerciseId = searchParams.get("exerciseId");
  if (!exerciseId) return NextResponse.json({ error: "missing_exerciseId" }, { status: 400 });

  const entries = await prisma.pREntry.findMany({
    where: { exerciseId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { exerciseId, date, primaryValue, secondaryValue, notes } = await req.json();
  if (!exerciseId || !date || primaryValue == null) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Verify the exercise belongs to this user
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise || exercise.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const entry = await prisma.pREntry.create({
    data: { userId, exerciseId, date, primaryValue, secondaryValue: secondaryValue ?? null, notes: notes ?? null },
  });

  return NextResponse.json({ entry });
}
