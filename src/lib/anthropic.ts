import Groq from "groq-sdk";
import type { FoodItem } from "@/types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function analyzeFoodEntry(input: string): Promise<FoodItem[]> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `Parse food descriptions and return JSON with an "items" array. Each item: name (string), quantity (string), calories (integer), protein (number), carbs (number), fat (number). If the user states calories, use that exact number.`,
      },
      { role: "user", content: input },
    ],
    temperature: 0.2,
    max_tokens: 1024,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  const items: FoodItem[] = Array.isArray(parsed) ? parsed : parsed.items ?? [];
  if (!Array.isArray(items)) throw new Error("Response is not an array");
  return items;
}
