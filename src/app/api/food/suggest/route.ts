import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUGGEST_SYSTEM = `You are a nutrition assistant helping someone decide what to eat next, based on how many calories and macros they have left for the day.

Given their remaining calories, protein, carbs, and fat, suggest exactly three real, specific, easy-to-find foods (or simple recipes) that fit within what's left:
- "sweet": a sweet option (dessert, fruit, baked good, etc.)
- "savory": a savory option (meal, snack, etc.)
- "both": one option that's a mix of sweet and savory (e.g. something salty-sweet, or a combo of two items)

Rules:
- Never suggest something whose calories exceed the remaining calories. If remaining calories are very low (under ~150) or negative, suggest minimal or zero-calorie options for all three and say so in "reply".
- Favor suggestions that help close whichever remaining macro gap is largest (protein/carbs/fat), without being absurd.
- Each suggestion needs realistic USDA-style macro estimates.
- Keep names concise and descriptions to one short sentence (why it fits).
- Return JSON with exactly these keys: "sweet", "savory", "both", each an object with: name (string), description (string, one sentence), calories (integer kcal), protein (number g), carbs (number g), fat (number g). Also include "reply" (one short sentence summarizing the picks).

Respond with only valid JSON, no explanation.`;

export async function POST(req: NextRequest) {
  const { remaining } = await req.json() as {
    remaining: { kcal: number; protein: number; carbs: number; fat: number };
  };

  if (!remaining) {
    return NextResponse.json({ error: "missing_remaining" }, { status: 400 });
  }

  const context = `Remaining today:
- Calories: ${Math.round(remaining.kcal)} kcal
- Protein: ${remaining.protein.toFixed(1)}g
- Carbs: ${remaining.carbs.toFixed(1)}g
- Fat: ${remaining.fat.toFixed(1)}g`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SUGGEST_SYSTEM,
    messages: [{ role: "user", content: context }],
  });

  try {
    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const result = JSON.parse(text) as {
      sweet: unknown;
      savory: unknown;
      both: unknown;
      reply: string;
    };

    for (const key of ["sweet", "savory", "both"] as const) {
      if (!result[key] || typeof result[key] !== "object") {
        throw new Error(`missing or invalid "${key}" suggestion`);
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Food suggest error:", msg);
    return NextResponse.json({ error: "suggest_failed", detail: msg }, { status: 422 });
  }
}
