import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { FoodItem } from "@/types";
import { filterZeroCalItems } from "@/lib/anthropic";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { message, currentItems } = await req.json() as {
    message: string;
    currentItems: FoodItem[];
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  const currentLog = currentItems.length === 0
    ? "(empty)"
    : currentItems.map((it, i) =>
        `${i + 1}. ${it.name} — ${it.quantity} — ${it.calories} cal, ${it.protein}g protein, ${it.carbs}g carbs, ${it.fat}g fat`
      ).join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a food log assistant with access to USDA nutritional data.

Rules:
- NEVER return 0 for calories, protein, carbs, or fat for real food items — always use USDA FoodData Central averages
- Scale all macros by quantity: "2 eggs" = 2× the single-egg values; adjust for preparation method when relevant
- When adding a new item, always populate all macro fields with real estimates, never leave at 0
- Only modify items the user explicitly mentions — copy all other items to the output exactly as given, with their exact existing calorie and macro values unchanged
- Return JSON with exactly two keys: "items" (complete updated list) and "reply" (one sentence summary)

Each item: name (string), quantity (string), calories (integer kcal), protein (number g), carbs (number g), fat (number g)`,
      },
      {
        role: "user",
        content: `Current log:\n${currentLog}\n\nRequest: ${message}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  try {
    const result = JSON.parse(completion.choices[0].message.content ?? "{}") as {
      items: FoodItem[];
      reply: string;
    };

    if (!Array.isArray(result.items)) throw new Error("items is not an array");

    // Restore values for items not explicitly mentioned by the user
    const msgLower = message.toLowerCase();
    const guardedItems = result.items.map((item) => {
      const original = currentItems.find(
        (c) => c.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!original || msgLower.includes(item.name.toLowerCase())) return item;
      return { ...item, calories: original.calories, protein: original.protein, carbs: original.carbs, fat: original.fat };
    });

    // Drop any items that still have 0 calories for real food (safety net)
    const { items: validItems, dropped } = filterZeroCalItems(guardedItems);

    let reply = result.reply ?? "";
    if (dropped.length > 0) {
      reply += ` (Could not estimate calories for: ${dropped.join(", ")} — please re-enter with more detail.)`;
    }

    return NextResponse.json({ ...result, items: validItems, reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Food chat error:", msg);
    return NextResponse.json({ error: "chat_failed", detail: msg }, { status: 422 });
  }
}
