import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId") ?? callerId;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const habits = await prisma.habitGoal.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    include: { logs: { where: { date } } },
  });

  return NextResponse.json({
    habits: habits.map((h) => ({ id: h.id, name: h.name, done: h.logs[0]?.done ?? false })),
  });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "missing_name" }, { status: 400 });

  const count = await prisma.habitGoal.count({ where: { userId } });
  const habit = await prisma.habitGoal.create({
    data: { userId, name: name.trim(), sortOrder: count },
  });

  return NextResponse.json({ habit: { id: habit.id, name: habit.name, done: false } });
}
