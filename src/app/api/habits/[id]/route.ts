import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habitGoal.findUnique({ where: { id } });
  if (!habit || habit.userId !== userId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.habitLog.deleteMany({ where: { habitId: id } });
  await prisma.habitGoal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
