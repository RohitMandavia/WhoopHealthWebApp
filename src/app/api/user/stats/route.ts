import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  // Allow viewing another user's stats (for friend view) via ?userId=
  const userId = req.nextUrl.searchParams.get("userId") ?? callerId;
  const stats = await prisma.userStats.findUnique({ where: { userId } });
  return NextResponse.json({ stats });
}

export async function PATCH(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { weightLbs, heightIn, age, bodyFatPct, mode, goalRate, targetWeightLbs, sleepGoalHours } = await req.json();

  const stats = await prisma.userStats.upsert({
    where: { userId },
    update: { weightLbs, heightIn, age, bodyFatPct, mode, goalRate, targetWeightLbs, sleepGoalHours },
    create: { userId, weightLbs, heightIn, age, bodyFatPct, mode, goalRate, targetWeightLbs, sleepGoalHours },
  });

  return NextResponse.json({ stats });
}
