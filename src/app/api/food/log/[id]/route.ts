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
  const { items } = await req.json();

  try {
    const log = await prisma.foodLog.update({
      where: { id, userId },
      data: { items },
    });
    return NextResponse.json({ log });
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
    await prisma.foodLog.delete({ where: { id, userId } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
