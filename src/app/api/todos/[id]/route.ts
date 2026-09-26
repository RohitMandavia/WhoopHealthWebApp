import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: { text?: string; done?: boolean; startDate?: string | null; parentId?: string | null } = {};
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim();
  if (typeof body.done === "boolean") data.done = body.done;
  if ("startDate" in body) {
    if (body.startDate == null || body.startDate === "") data.startDate = null;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) data.startDate = body.startDate;
    else return NextResponse.json({ error: "bad_date" }, { status: 400 });
  }
  if ("parentId" in body) {
    if (body.parentId == null) {
      data.parentId = null;
    } else {
      if (body.parentId === id) return NextResponse.json({ error: "self_parent" }, { status: 400 });
      const parent = await prisma.todo.findFirst({ where: { id: body.parentId, userId }, select: { id: true, parentId: true } });
      if (!parent) return NextResponse.json({ error: "parent_not_found" }, { status: 404 });
      if (parent.parentId) return NextResponse.json({ error: "nesting_too_deep" }, { status: 400 });
      const hasChildren = await prisma.todo.findFirst({ where: { parentId: id }, select: { id: true } });
      if (hasChildren) return NextResponse.json({ error: "nesting_too_deep" }, { status: 400 });
      data.parentId = parent.id;
    }
  }

  try {
    const todo = await prisma.todo.update({ where: { id, userId }, data });
    return NextResponse.json({ todo });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.todo.delete({ where: { id, userId } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
