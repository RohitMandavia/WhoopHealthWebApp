import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ connected: false });

  const token = await prisma.googleToken.findUnique({ where: { userId } });
  return NextResponse.json({ connected: !!token });
}
