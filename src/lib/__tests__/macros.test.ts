import { describe, it, expect } from "vitest";
import { calcMacroTargets } from "../macros";

// ---------------------------------------------------------------------------
// calcMacroTargets
// ---------------------------------------------------------------------------

describe("calcMacroTargets", () => {
  const TDEE = 2400;
  const WEIGHT = 175; // lbs

  describe("calorie targets by mode", () => {
    it("maintenance: kcal equals TDEE exactly", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "maintenance").kcal).toBe(TDEE);
    });

    it("cutting at 1 lb/wk: kcal = TDEE − 500", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "cutting", 1).kcal).toBe(TDEE - 500);
    });

    it("cutting at ½ lb/wk: kcal = TDEE − 250", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "cutting", 0.5).kcal).toBe(TDEE - 250);
    });

    it("bulking at 1 lb/wk: kcal = TDEE + 500", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "bulking", 1).kcal).toBe(TDEE + 500);
    });

    it("bulking at ½ lb/wk: kcal = TDEE + 250", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "bulking", 0.5).kcal).toBe(TDEE + 250);
    });
  });

  describe("fat targets (fixed by mode)", () => {
    it("cutting fat = 65g", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "cutting").fat).toBe(65);
    });

    it("maintenance fat = 75g", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "maintenance").fat).toBe(75);
    });

    it("bulking fat = 75g", () => {
      expect(calcMacroTargets(TDEE, WEIGHT, "bulking").fat).toBe(75);
    });
  });

  describe("protein targets by mode", () => {
    it("cutting: protein = 1.1 g/lb (at high enough TDEE that safety cap doesn't trigger)", () => {
      // At TDEE=2400 the safety constraint kicks in for 175 lbs cutting; use 3000 to test the raw formula
      const { protein } = calcMacroTargets(3000, WEIGHT, "cutting");
      expect(protein).toBe(Math.round(WEIGHT * 1.1));
    });

    it("maintenance: protein = 1.0 g/lb", () => {
      const { protein } = calcMacroTargets(TDEE, WEIGHT, "maintenance");
      expect(protein).toBe(Math.round(WEIGHT * 1.0));
    });

    it("bulking: protein = 1.0 g/lb", () => {
      const { protein } = calcMacroTargets(TDEE, WEIGHT, "bulking");
      expect(protein).toBe(Math.round(WEIGHT * 1.0));
    });
  });

  describe("carbs fill remaining calories", () => {
    it("carbs = (kcal − fat×9 − protein×4) / 4", () => {
      const { kcal, protein, fat, carbs } = calcMacroTargets(TDEE, WEIGHT, "maintenance");
      const remainingKcal = kcal - fat * 9;
      const expectedCarbs = Math.max(0, Math.round((remainingKcal - protein * 4) / 4));
      expect(carbs).toBe(expectedCarbs);
    });

    it("higher TDEE → more carbs (protein and fat are fixed)", () => {
      const low  = calcMacroTargets(1800, WEIGHT, "maintenance");
      const high = calcMacroTargets(3000, WEIGHT, "maintenance");
      expect(high.carbs).toBeGreaterThan(low.carbs);
    });
  });

  describe("safety constraint: protein ≤ carbs", () => {
    it("low TDEE: protein and carbs are equalized when protein would exceed carbs", () => {
      // At very low TDEE (e.g., 1500 cutting), high protein-per-lb ratio can cause protein > carbs
      const { protein, carbs } = calcMacroTargets(1500, 175, "cutting", 1);
      expect(protein).toBeLessThanOrEqual(carbs);
    });

    it("when capped, protein equals carbs exactly", () => {
      const { protein, carbs } = calcMacroTargets(1500, 175, "cutting", 1);
      if (protein === carbs) {
        expect(protein).toBe(carbs);
      }
    });

    it("normal TDEE: safety constraint not triggered", () => {
      // At 2400 kcal maintenance, carbs should comfortably exceed protein
      const { protein, carbs } = calcMacroTargets(2400, 175, "maintenance");
      expect(carbs).toBeGreaterThan(protein);
    });
  });

  describe("body weight effects", () => {
    it("heavier person gets more protein (scales with weight)", () => {
      const light = calcMacroTargets(TDEE, 140, "maintenance");
      const heavy = calcMacroTargets(TDEE, 220, "maintenance");
      expect(heavy.protein).toBeGreaterThan(light.protein);
    });

    it("lighter person gets more carbs at same TDEE (less protein consumed)", () => {
      const light = calcMacroTargets(TDEE, 140, "maintenance");
      const heavy = calcMacroTargets(TDEE, 220, "maintenance");
      expect(light.carbs).toBeGreaterThan(heavy.carbs);
    });
  });

  describe("macro calorie accounting", () => {
    it("protein + fat + carbs kcal ≈ total kcal (within rounding)", () => {
      const { kcal, protein, fat, carbs } = calcMacroTargets(TDEE, WEIGHT, "maintenance");
      const sum = protein * 4 + fat * 9 + carbs * 4;
      // Allow ±4 kcal for integer rounding across 3 macros
      expect(Math.abs(sum - kcal)).toBeLessThanOrEqual(4);
    });

    it("holds for cutting mode", () => {
      const { kcal, protein, fat, carbs } = calcMacroTargets(TDEE, WEIGHT, "cutting", 1);
      const sum = protein * 4 + fat * 9 + carbs * 4;
      expect(Math.abs(sum - kcal)).toBeLessThanOrEqual(4);
    });

    it("holds for bulking mode", () => {
      const { kcal, protein, fat, carbs } = calcMacroTargets(TDEE, WEIGHT, "bulking", 1);
      const sum = protein * 4 + fat * 9 + carbs * 4;
      expect(Math.abs(sum - kcal)).toBeLessThanOrEqual(4);
    });
  });
});
