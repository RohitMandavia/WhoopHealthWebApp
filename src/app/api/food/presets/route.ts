import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Allow viewing presets of another user (for friend view)
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId") ?? getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const presets = await prisma.foodPreset.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ presets });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { name, quantity, calories, protein, carbs, fat } = await req.json();
  const preset = await prisma.foodPreset.create({
    data: { userId, name, quantity, calories, protein, carbs, fat },
  });
  return NextResponse.json({ preset });
}
