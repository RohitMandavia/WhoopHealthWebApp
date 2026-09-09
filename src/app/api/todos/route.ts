import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId") ?? callerId;

  const todos = await prisma.todo.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ todos });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { text, startDate } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (startDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    return NextResponse.json({ error: "bad_date" }, { status: 400 });

  const last = await prisma.todo.findFirst({
    where: { userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const todo = await prisma.todo.create({
    data: {
      userId,
      text: text.trim(),
      startDate: startDate || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ todo });
}
