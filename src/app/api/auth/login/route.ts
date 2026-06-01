import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name } = await req.json() as { name?: string };
  const trimmed = name?.trim();

  if (!trimmed) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });

  const cookieStore = await cookies();
  cookieStore.set("userId", user.id, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  return NextResponse.json({ user: { id: user.id, name: user.name } });
}
