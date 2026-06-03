import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Delete entries first, then the exercise
  await prisma.pREntry.deleteMany({ where: { exerciseId: id } });
  await prisma.exercise.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
