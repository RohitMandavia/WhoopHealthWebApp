import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { FoodItem } from "@/types";

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
        content: `You are a food log assistant. You will be given a current food log and a user request to add, remove, or edit items. Return JSON with two keys: "items" (the complete updated list) and "reply" (one sentence summary of the change). Each item has: name, quantity, calories (integer kcal), protein (g), carbs (g), fat (g). Do not change the values of items the user did not mention.`,
      },
      {
        role: "user",
        content: `Current log:\n${currentLog}\n\nRequest: ${message}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  try {
    const result = JSON.parse(completion.choices[0].message.content ?? "{}") as {
      items: FoodItem[];
      reply: string;
    };

    if (!Array.isArray(result.items)) throw new Error("items is not an array");

    // Restore values for items not mentioned by the user
    const msgLower = message.toLowerCase();
    const guardedItems = result.items.map((item) => {
      const original = currentItems.find(
        (c) => c.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!original || msgLower.includes(item.name.toLowerCase())) return item;
      return { ...item, calories: original.calories, protein: original.protein, carbs: original.carbs, fat: original.fat };
    });

    return NextResponse.json({ ...result, items: guardedItems });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Food chat error:", msg);
    return NextResponse.json({ error: "chat_failed", detail: msg }, { status: 422 });
  }
}
