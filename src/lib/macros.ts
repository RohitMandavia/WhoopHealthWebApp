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
  const protein = Math.round(weightLbs * PROTEIN_PER_LB[mode]);
  const fat = FAT_GRAMS[mode];
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs };
}
