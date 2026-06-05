import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const callerId = getCurrentUserId(req);
  if (!callerId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId") ?? callerId;
  const overrides = await prisma.workoutCalOverride.findMany({ where: { userId } });
  // Return as a map of workoutKey → kcal for easy lookup
  const map: Record<string, number> = {};
  for (const o of overrides) map[o.workoutKey] = o.kcal;
  return NextResponse.json({ overrides: map });
}

export async function PATCH(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { workoutKey, kcal } = await req.json() as { workoutKey: string; kcal: number };
  const override = await prisma.workoutCalOverride.upsert({
    where: { userId_workoutKey: { userId, workoutKey } },
    update: { kcal: Math.round(kcal) },
    create: { userId, workoutKey, kcal: Math.round(kcal) },
  });
  return NextResponse.json({ override });
}
