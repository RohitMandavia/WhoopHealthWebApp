import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId") ?? callerId;
  const exercises = await prisma.exercise.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    include: { entries: { orderBy: { date: "desc" } } },
  });

  return NextResponse.json({ exercises });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { name, type } = await req.json();
  if (!name?.trim() || !type) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const count = await prisma.exercise.count({ where: { userId } });
  const exercise = await prisma.exercise.create({
    data: { userId, name: name.trim(), type, sortOrder: count },
    include: { entries: true },
  });

  return NextResponse.json({ exercise });
}
