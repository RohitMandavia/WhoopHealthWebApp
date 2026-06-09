import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import type { FoodItem } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUMMARY_SYSTEM = `You are a friendly, knowledgeable health coach. Given a user's full day of health data, write a concise personalized end-of-day recap.

Structure your response as 3–4 short paragraphs covering:
1. Nutrition: calories and macros vs. targets — be specific with numbers, note wins and gaps
2. Activity & Recovery: workouts, steps, Whoop recovery/strain if available; note rest days graciously
3. Habits & sleep: which habits were completed, sleep quality/duration if data exists
4. Tomorrow: 1–2 concrete, actionable tips based on today's data

Tone: encouraging but honest. Use specific numbers from the data. Keep it under 200 words total. Do not use markdown headers or bullet points — just natural prose paragraphs.`;

export async function POST(req: NextRequest) {
  const { userId, date, targets, tz } = await req.json() as {
    userId: string;
    date: string;
    targets: { kcal: number; protein: number; carbs: number; fat: number };
    tz?: string;
  };

  if (!userId || !date) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  // Gather all data in parallel
  const [foodLogs, stepEntry, caffeineLogs, vitaminLog, waterLog, stretchLog, habitLogs] = await Promise.all([
    prisma.foodLog.findMany({ where: { userId, date } }),
    prisma.stepEntry.findFirst({ where: { userId, date } }),
    prisma.caffeineLog.findMany({ where: { userId, date } }),
    prisma.vitaminLog.findFirst({ where: { userId, date } }),
    prisma.waterLog.findFirst({ where: { userId, date } }),
    prisma.stretchLog.findFirst({ where: { userId, date } }),
    prisma.habitLog.findMany({ where: { userId, date }, include: { habit: true } }),
  ]);

  // Aggregate food
  const allItems: FoodItem[] = foodLogs.flatMap((log) => {
    try { return (log.items as unknown) as FoodItem[]; } catch { return []; }
  });
  const totalCal = allItems.reduce((s, i) => s + i.calories, 0);
  const totalProtein = allItems.reduce((s, i) => s + i.protein, 0);
  const totalCarbs = allItems.reduce((s, i) => s + i.carbs, 0);
  const totalFat = allItems.reduce((s, i) => s + i.fat, 0);
  const totalCaffeine = caffeineLogs.reduce((s, l) => s + l.mg, 0);
  const foodNames = allItems.slice(0, 8).map((i) => i.name).join(", ");

  // Fetch Whoop data (best-effort, for activity/sleep context only)
  let whoopSummary = "No Whoop data available for today.";
  try {
    const whoopTz = tz ?? "UTC";
    const whoopRes = await fetch(
      `${req.nextUrl.origin}/api/whoop/daily?date=${date}&userId=${userId}&tz=${encodeURIComponent(whoopTz)}`
    );
    if (whoopRes.ok) {
      const w = await whoopRes.json();
      if (!w.error) {
        const workoutLines = (w.workouts ?? []).map((wk: { sport: string; strain: number; kilojoules: number }) =>
          `${wk.sport} (strain ${wk.strain?.toFixed(1)}, ~${Math.round(wk.kilojoules * 0.239)} kcal)`
        ).join("; ") || "no workouts logged";
        const sleep = w.sleep;
        const sleepLine = sleep
          ? `slept ${(sleep.totalInBed / 3600).toFixed(1)}h, quality ${sleep.performancePercent?.toFixed(0) ?? "?"}%`
          : "no sleep data";
        const recovery = w.recovery;
        const recoveryLine = recovery
          ? `recovery ${recovery.recoveryScore?.toFixed(0) ?? "?"}%, HRV ${recovery.hrv?.toFixed(0) ?? "?"}ms, RHR ${recovery.rhr?.toFixed(0) ?? "?"}bpm`
          : "no recovery data";
        whoopSummary = `Workouts: ${workoutLines}. Sleep: ${sleepLine}. Recovery: ${recoveryLine}.`;
      }
    }
  } catch {
    // non-fatal
  }

  // Build the data context for Claude
  const habitsCompleted = [
    vitaminLog?.taken ? "vitamins" : null,
    waterLog?.done ? "water" : null,
    stretchLog?.done ? "stretching" : null,
    ...habitLogs.filter((h) => h.done).map((h) => (h.habit as { name: string }).name),
  ].filter(Boolean);
  const habitsMissed = [
    !vitaminLog?.taken ? "vitamins" : null,
    !waterLog?.done ? "water" : null,
    !stretchLog?.done ? "stretching" : null,
    ...habitLogs.filter((h) => !h.done).map((h) => (h.habit as { name: string }).name),
  ].filter(Boolean);

  const dataContext = `
DATE: ${date}

NUTRITION:
- Calories: ${Math.round(totalCal)} / ${targets.kcal} kcal target
- Protein: ${totalProtein.toFixed(1)} / ${targets.protein}g target
- Carbs: ${totalCarbs.toFixed(1)} / ${targets.carbs}g target
- Fat: ${totalFat.toFixed(1)} / ${targets.fat}g target
- Caffeine: ${totalCaffeine}mg
- Foods eaten: ${foodNames || "nothing logged"}

ACTIVITY:
- Steps: ${stepEntry?.steps ?? 0}
- ${whoopSummary}

HABITS:
- Completed: ${habitsCompleted.join(", ") || "none"}
- Missed: ${habitsMissed.join(", ") || "none"}
`.trim();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: dataContext }],
  });

  const summary = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ summary });
}
