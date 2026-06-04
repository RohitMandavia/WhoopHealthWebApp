import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { FoodItem } from "@/types";
import { filterZeroCalItems } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CHAT_SYSTEM = `You are a food log assistant with access to USDA nutritional data.

Rules:
- NEVER return 0 for calories, protein, carbs, or fat for real food items — always use USDA FoodData Central averages
- Scale all macros by quantity: "2 eggs" = 2× the single-egg values; adjust for preparation method when relevant
- When adding a new item, always populate all macro fields with real estimates, never leave at 0
- Only modify items the user explicitly mentions — copy all other items to the output exactly as given, with their exact existing calorie and macro values unchanged
- Return JSON with exactly two keys: "items" (complete updated list) and "reply" (one sentence summary)

Each item: name (string), quantity (string), calories (integer kcal), protein (number g), carbs (number g), fat (number g). If the item contains caffeine (coffee, espresso, tea, matcha, energy drink, etc.), also include caffeineMg (integer, milligrams). Common values: black coffee 8oz=95mg, espresso shot=63mg, latte/cappuccino=63mg per shot, black tea 8oz=47mg, green tea 8oz=28mg, matcha 8oz=70mg. Omit caffeineMg for items without caffeine.

Respond with only valid JSON, no explanation.`;

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  const { message, currentItems, date } = await req.json() as {
    message: string;
    currentItems: FoodItem[];
    date?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  const currentLog = currentItems.length === 0
    ? "(empty)"
    : currentItems.map((it, i) => {
        const base = `${i + 1}. ${it.name} — ${it.quantity} — ${it.calories} cal, ${it.protein}g protein, ${it.carbs}g carbs, ${it.fat}g fat`;
        return it.caffeineMg ? `${base}, ${it.caffeineMg}mg caffeine` : base;
      }).join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: CHAT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Current log:\n${currentLog}\n\nRequest: ${message}`,
      },
    ],
  });

  try {
    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const result = JSON.parse(text) as { items: FoodItem[]; reply: string };

    if (!Array.isArray(result.items)) throw new Error("items is not an array");

    // Restore values for items not mentioned by the user
    const msgLower = message.toLowerCase();

    function userMentionedItem(itemName: string): boolean {
      const words = itemName.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return words.some((w) => msgLower.includes(w));
    }

    const guardedItems = result.items.map((item) => {
      const original = currentItems.find(
        (c) => c.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!original || userMentionedItem(item.name)) return item;
      return { ...item, calories: original.calories, protein: original.protein, carbs: original.carbs, fat: original.fat, caffeineMg: original.caffeineMg };
    });

    const { items: validItems, dropped } = filterZeroCalItems(guardedItems);

    let reply = result.reply ?? "";
    if (dropped.length > 0) {
      reply += ` (Could not estimate calories for: ${dropped.join(", ")} — please re-enter with more detail.)`;
    }

    // Auto-add caffeine log for items that are new to the log
    if (userId && date) {
      const existingNames = new Set(currentItems.map((i) => i.name.toLowerCase().trim()));
      const newCaffeineItems = validItems.filter(
        (i) => (i.caffeineMg ?? 0) > 0 && !existingNames.has(i.name.toLowerCase().trim())
      );
      if (newCaffeineItems.length > 0) {
        await prisma.caffeineLog.createMany({
          data: newCaffeineItems.map((i) => ({
            userId,
            date,
            mg: Math.round(i.caffeineMg!),
            source: i.name,
            time: null,
          })),
        });
      }
    }

    return NextResponse.json({ ...result, items: validItems, reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Food chat error:", msg);
    return NextResponse.json({ error: "chat_failed", detail: msg }, { status: 422 });
  }
}
