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

  const { text, startDate, parentId } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (startDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    return NextResponse.json({ error: "bad_date" }, { status: 400 });

  let parent: { id: string; parentId: string | null } | null = null;
  if (parentId != null) {
    parent = await prisma.todo.findFirst({ where: { id: parentId, userId }, select: { id: true, parentId: true } });
    if (!parent) return NextResponse.json({ error: "parent_not_found" }, { status: 404 });
    if (parent.parentId) return NextResponse.json({ error: "nesting_too_deep" }, { status: 400 });
  }

  // New tasks go to the top of their list (or the top of their family, for
  // subtasks) — one below the current lowest sortOrder among siblings.
  const first = await prisma.todo.findFirst({
    where: { userId, parentId: parent?.id ?? null },
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });

  const todo = await prisma.todo.create({
    data: {
      userId,
      text: text.trim(),
      startDate: startDate || null,
      parentId: parent?.id ?? null,
      sortOrder: (first?.sortOrder ?? 0) - 1,
    },
  });
  return NextResponse.json({ todo });
}
