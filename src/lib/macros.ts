export type Mode = "cutting" | "maintenance" | "bulking";

export interface MacroTargets {
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
}

// goalRate: lbs per week (0.5 or 1.0)
// 0.5 lb/wk = 250 kcal/day deficit or surplus
// 1.0 lb/wk = 500 kcal/day deficit or surplus
function calorieDelta(mode: Mode, goalRate: number): number {
  if (mode === "maintenance") return 0;
  const daily = Math.round(goalRate * 500); // 500 kcal per lb per week
  return mode === "cutting" ? -daily : daily;
}

const PROTEIN_PER_LB: Record<Mode, number> = {
  cutting: 1.1,
  maintenance: 1.0,
  bulking: 1.0,
};

const FAT_GRAMS: Record<Mode, number> = {
  cutting: 65,
  maintenance: 75,
  bulking: 75,
};

export function calcMacroTargets(tdee: number, weightLbs: number, mode: Mode, goalRate = 1): MacroTargets {
  const kcal = Math.round(tdee + calorieDelta(mode, goalRate));
  const fat = FAT_GRAMS[mode];
  const remainingKcal = kcal - fat * 9;

  let protein = Math.round(weightLbs * PROTEIN_PER_LB[mode]);
  let carbs = Math.max(0, Math.round((remainingKcal - protein * 4) / 4));

  // Safety: protein should never exceed carbs (e.g. low-activity days).
  // When it would, split the remaining calories equally so protein === carbs.
  if (protein > carbs && remainingKcal > 0) {
    const equal = Math.max(0, Math.round(remainingKcal / 8));
    protein = equal;
    carbs = equal;
  }

  return { kcal, protein, fat, carbs };
}
