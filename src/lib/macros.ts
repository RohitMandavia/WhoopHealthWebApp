export type Mode = "cutting" | "maintenance" | "bulking";

export interface MacroTargets {
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
}

const CALORIE_DELTA: Record<Mode, number> = {
  cutting: -400,
  maintenance: 0,
  bulking: 350,
};

export function calcMacroTargets(tdee: number, weightLbs: number, mode: Mode): MacroTargets {
  const kcal = Math.round(tdee + CALORIE_DELTA[mode]);
  const protein = Math.round(weightLbs * 1.0);       // 1 g per lb — preserves/builds muscle
  const fat = Math.round((kcal * 0.25) / 9);         // 25% of calories from fat
  const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4); // remainder from carbs
  return { kcal, protein, fat, carbs: Math.max(0, carbs) };
}
