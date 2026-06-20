import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.todo.updateMany({ where: { id, userId }, data: { sortOrder: i } })
    )
  );

  return NextResponse.json({ ok: true });
}
