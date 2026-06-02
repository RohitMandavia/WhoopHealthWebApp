import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const ADMIN_NAME = "Rohit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const caller = await prisma.user.findUnique({ where: { id: callerId } });
  if (caller?.name !== ADMIN_NAME) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (id === callerId) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  // Cascade delete all user data
  await prisma.$transaction([
    prisma.foodLog.deleteMany({ where: { userId: id } }),
    prisma.foodPreset.deleteMany({ where: { userId: id } }),
    prisma.stepEntry.deleteMany({ where: { userId: id } }),
    prisma.userStats.deleteMany({ where: { userId: id } }),
    prisma.whoopToken.deleteMany({ where: { userId: id } }),
    prisma.googleToken.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ deleted: true });
}
