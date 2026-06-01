import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  // Allow viewing another user's log via ?userId= (for friend view)
  const userId = searchParams.get("userId") ?? getCurrentUserId(req);

  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const logs = await prisma.foodLog.findMany({
    where: { date, userId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { date, rawInput, items } = await req.json();
  if (!date || !rawInput || !Array.isArray(items)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const log = await prisma.foodLog.create({
    data: { userId, date, rawInput, items },
  });

  return NextResponse.json({ log });
}

export async function DELETE(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  await prisma.foodLog.deleteMany({ where: { date, userId } });
  return NextResponse.json({ cleared: true });
}
