import Anthropic from "@anthropic-ai/sdk";
import type { FoodItem } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Name-based caffeine lookup — used as a fallback when Claude omits caffeineMg
const CAFFEINE_PATTERNS: Array<{ re: RegExp; mg: number }> = [
  { re: /cold brew/i,                                mg: 155 },
  { re: /venti/i,                                    mg: 225 },
  { re: /grande/i,                                   mg: 150 },
  { re: /tall\s+(latte|cappuccino|americano|mocha|macchiato|coffee)/i, mg: 75 },
  { re: /espresso/i,                                 mg: 63  },
  { re: /latte|cappuccino|flat white|cortado/i,      mg: 150 },
  { re: /americano/i,                                mg: 150 },
  { re: /mocha/i,                                    mg: 150 },
  { re: /macchiato/i,                                mg: 150 },
  { re: /matcha/i,                                   mg: 70  },
  { re: /green tea/i,                                mg: 28  },
  { re: /black tea/i,                                mg: 47  },
  { re: /oolong/i,                                   mg: 37  },
  { re: /chai/i,                                     mg: 50  },
  { re: /red bull/i,                                 mg: 80  },
  { re: /monster/i,                                  mg: 160 },
  { re: /celsius/i,                                  mg: 200 },
  { re: /bang energy/i,                              mg: 300 },
  { re: /pre.?workout/i,                             mg: 150 },
  { re: /coffee/i,                                   mg: 95  },
  { re: /\btea\b/i,                                  mg: 47  },
];

export function estimateCaffeineMg(name: string): number {
  for (const { re, mg } of CAFFEINE_PATTERNS) {
    if (re.test(name)) return mg;
  }
  return 0;
}

const ZERO_CAL_EXCEPTIONS = ["water", "coffee", "tea", "diet", "sparkling water", "soda water", "La Croix", "Celsius"];

function isLegitimatelyZeroCal(name: string): boolean {
  const lower = name.toLowerCase();
  return ZERO_CAL_EXCEPTIONS.some((w) => lower.includes(w.toLowerCase()));
}

export function filterZeroCalItems(items: FoodItem[]): { items: FoodItem[]; dropped: string[] } {
  const valid: FoodItem[] = [];
  const dropped: string[] = [];
  for (const item of items) {
    if (item.calories === 0 && !isLegitimatelyZeroCal(item.name)) {
      dropped.push(item.name);
    } else {
      valid.push(item);
    }
  }
  return { items: valid, dropped };
}

const PARSE_SYSTEM = `You are a precise nutrition database. When given food descriptions, return a JSON object with an "items" array.

Rules:
- Use USDA FoodData Central averages for all estimates
- NEVER return 0 for calories, protein, carbs, or fat unless the item genuinely has none (e.g. water, plain black coffee, plain tea, diet soda)
- Split compound entries into separate items ("eggs and toast" → one egg item, one toast item)
- Scale macros by quantity: "2 eggs" = 2× the values of 1 egg; adjust for preparation method when relevant
- When quantity is ambiguous, use a typical single serving
- If the user states a specific calorie number, use exactly that number

Each item must have: name (string), quantity (string, e.g. "2 large"), calories (integer kcal, never 0 for real food), protein (number, grams, 1 decimal), carbs (number, grams, 1 decimal), fat (number, grams, 1 decimal)

If the item contains caffeine (coffee, espresso, tea, matcha, energy drink, pre-workout, etc.), also include caffeineMg (integer, milligrams). IMPORTANT: caffeineMg must be scaled to the actual quantity logged, exactly like calories and macros — if the user logged half a serving, caffeineMg should be half the full-serving caffeine amount. Do NOT return the per-serving label amount unless the full serving was consumed. Common full-serving values: black coffee 8oz=95mg, espresso shot=63mg, latte/cappuccino=63mg per shot, black tea 8oz=47mg, green tea 8oz=28mg, matcha 8oz=70mg, Red Bull 8oz=80mg, pre-workout full scoop=150-300mg. Omit caffeineMg entirely for items without caffeine.

Respond with only valid JSON, no explanation.`;

export async function analyzeFoodEntry(input: string): Promise<FoodItem[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: PARSE_SYSTEM,
    messages: [
      { role: "user", content: input },
    ],
  });

  const responseText = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  const items: FoodItem[] = Array.isArray(parsed) ? parsed : parsed.items ?? [];
  if (!Array.isArray(items)) throw new Error("Response is not an array");

  const { items: validItems } = filterZeroCalItems(items);
  return validItems;
}
