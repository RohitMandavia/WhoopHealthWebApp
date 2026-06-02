export type Mode = "cutting" | "maintenance" | "bulking";

export interface MacroTargets {
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
}

const CALORIE_DELTA: Record<Mode, number> = {
  cutting: -500,
  maintenance: 0,
  bulking: 250,
};

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

export function calcMacroTargets(tdee: number, weightLbs: number, mode: Mode): MacroTargets {
  const kcal = Math.round(tdee + CALORIE_DELTA[mode]);
  const protein = Math.round(weightLbs * PROTEIN_PER_LB[mode]);
  const fat = FAT_GRAMS[mode];
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs };
}
