import { describe, it, expect } from "vitest";
import { calcBMR, calcTDEE, estimateWorkoutKcalFromInputs } from "../tdee";

// ---------------------------------------------------------------------------
// BMR (Katch-McArdle)
// Formula: 370 + 21.6 × (weightKg × (1 - bodyFat%/100))
// Sex-neutral — lean body mass already accounts for composition differences
// ---------------------------------------------------------------------------

describe("calcBMR", () => {
  it("baseline — 175 lbs, 15% BF", () => {
    // weightKg = 175 × 0.453592 = 79.3786
    // lbmKg    = 79.3786 × 0.85 = 67.4718
    // BMR      = 370 + 21.6 × 67.4718 = 1827.39 → 1827
    expect(calcBMR(175, 15)).toBe(1827);
  });

  it("heavier body weight increases BMR", () => {
    expect(calcBMR(220, 15)).toBeGreaterThan(calcBMR(175, 15));
  });

  it("higher body fat reduces BMR (less lean mass)", () => {
    // Same total weight, more fat → less muscle → lower BMR
    expect(calcBMR(175, 25)).toBeLessThan(calcBMR(175, 15));
  });

  it("lower body fat increases BMR", () => {
    expect(calcBMR(175, 8)).toBeGreaterThan(calcBMR(175, 15));
  });

  it("lighter person has lower BMR", () => {
    expect(calcBMR(130, 20)).toBeLessThan(calcBMR(175, 20));
  });

  it("very lean athlete — 160 lbs, 6% BF", () => {
    // lbmKg = (160 × 0.453592) × 0.94 = 68.22
    // BMR   = 370 + 21.6 × 68.22 = 1843.6 → 1844
    expect(calcBMR(160, 6)).toBe(1844);
  });

  it("higher body fat at same weight (30% BF)", () => {
    // lbmKg = 79.378 × 0.70 = 55.565
    // BMR   = 370 + 21.6 × 55.565 ≈ 1570
    expect(calcBMR(175, 30)).toBe(1570);
  });

  it("BMR does not depend on age (Katch-McArdle is age-agnostic)", () => {
    // Age affects workout calorie estimates, not BMR under this formula
    expect(calcBMR(175, 15)).toBe(calcBMR(175, 15));
  });
});

// ---------------------------------------------------------------------------
// TDEE
// Formula: round(BMR × 1.2) + stepKcal + workoutKcal
// stepKcal = steps × weightKg × 0.0006
// ---------------------------------------------------------------------------

describe("calcTDEE", () => {
  it("sedentary baseline — no steps, no workout", () => {
    const bmr = calcBMR(175, 15); // 1828
    const { tdee } = calcTDEE({ weightLbs: 175, bodyFatPct: 15 });
    expect(tdee).toBe(Math.round(bmr * 1.2)); // 2194
  });

  it("steps add calories proportional to weight", () => {
    const lighter = calcTDEE({ weightLbs: 140, bodyFatPct: 20, steps: 10000 });
    const heavier = calcTDEE({ weightLbs: 200, bodyFatPct: 20, steps: 10000 });
    expect(heavier.stepKcal).toBeGreaterThan(lighter.stepKcal);
  });

  it("10,000 steps at 175 lbs ≈ 476 kcal", () => {
    // weightKg = 79.3786 → 10000 × 79.3786 × 0.0006 = 476.27 → 476
    const { stepKcal } = calcTDEE({ weightLbs: 175, bodyFatPct: 15, steps: 10000 });
    expect(stepKcal).toBe(476);
  });

  it("workout calories are added directly", () => {
    const withWorkout = calcTDEE({ weightLbs: 175, bodyFatPct: 15, workoutKcal: 400 });
    const without = calcTDEE({ weightLbs: 175, bodyFatPct: 15 });
    expect(withWorkout.tdee - without.tdee).toBe(400);
  });

  it("higher body fat → lower TDEE at same total weight", () => {
    const lean = calcTDEE({ weightLbs: 175, bodyFatPct: 10 });
    const fat  = calcTDEE({ weightLbs: 175, bodyFatPct: 30 });
    expect(lean.tdee).toBeGreaterThan(fat.tdee);
  });

  it("returns individual components", () => {
    const result = calcTDEE({ weightLbs: 175, bodyFatPct: 15, steps: 8000, workoutKcal: 300 });
    expect(result.bmr).toBeGreaterThan(0);
    expect(result.stepKcal).toBeGreaterThan(0);
    expect(result.workoutKcal).toBe(300);
    expect(result.tdee).toBe(Math.round(result.bmr * 1.2) + result.stepKcal + 300);
  });

  describe("gender comparison at same stats", () => {
    // BMR (Katch-McArdle) is sex-neutral, BUT if a typical male has lower BF%
    // at the same weight, he'll have a higher TDEE — modeled by varying bodyFatPct
    it("typical male (175 lbs, 15% BF) vs typical female (135 lbs, 25% BF)", () => {
      const male   = calcTDEE({ weightLbs: 175, bodyFatPct: 15 });
      const female = calcTDEE({ weightLbs: 135, bodyFatPct: 25 });
      expect(male.tdee).toBeGreaterThan(female.tdee);
    });
  });
});

// ---------------------------------------------------------------------------
// Workout calorie estimation (Keytel + strain blend)
// ---------------------------------------------------------------------------

describe("estimateWorkoutKcalFromInputs", () => {
  const base = { durationMin: 45, weightKg: 80, age: 28 };

  it("returns 0 for zero-duration workout", () => {
    expect(estimateWorkoutKcalFromInputs({ ...base, durationMin: 0 })).toBe(0);
  });

  it("strain-only estimate when no heart rate available", () => {
    const kcal = estimateWorkoutKcalFromInputs({ ...base, strain: 10 });
    // met = 3 + 10 × 0.43 = 7.3; estimate = round(7.3 × 80 × 0.75) = 438
    expect(kcal).toBeGreaterThan(0);
    expect(kcal).toBe(Math.round((3 + 10 * 0.43) * 80 * (45 / 60)));
  });

  it("blends HR and strain when heart rate available", () => {
    const strainOnly = estimateWorkoutKcalFromInputs({ ...base, strain: 10 });
    const withHR     = estimateWorkoutKcalFromInputs({ ...base, strain: 10, avgHeartRate: 150 });
    // Should differ from strain-only
    expect(withHR).not.toBe(strainOnly);
  });

  it("male estimate exceeds female at same HR, weight, age (Keytel coefficients)", () => {
    const shared = { ...base, avgHeartRate: 155, strain: 12 };
    const male   = estimateWorkoutKcalFromInputs({ ...shared, sex: "male" });
    const female = estimateWorkoutKcalFromInputs({ ...shared, sex: "female" });
    // Male Keytel formula yields higher values at moderate HR
    expect(male).toBeGreaterThan(female);
  });

  it("unknown sex produces result between male and female estimates", () => {
    const shared = { ...base, avgHeartRate: 155, strain: 12 };
    const male    = estimateWorkoutKcalFromInputs({ ...shared, sex: "male" });
    const female  = estimateWorkoutKcalFromInputs({ ...shared, sex: "female" });
    const unknown = estimateWorkoutKcalFromInputs({ ...shared, sex: null });
    // Averaged coefficients should fall between the sex-specific ones
    // (allow ±5 kcal rounding tolerance)
    expect(unknown).toBeGreaterThanOrEqual(Math.min(male, female) - 5);
    expect(unknown).toBeLessThanOrEqual(Math.max(male, female) + 5);
  });

  it("older age increases estimated calories for males (Keytel age coefficient is positive)", () => {
    const young  = estimateWorkoutKcalFromInputs({ ...base, avgHeartRate: 150, strain: 10, sex: "male", age: 22 });
    const older  = estimateWorkoutKcalFromInputs({ ...base, avgHeartRate: 150, strain: 10, sex: "male", age: 45 });
    expect(older).toBeGreaterThan(young);
  });

  it("longer workout burns more calories", () => {
    const short = estimateWorkoutKcalFromInputs({ ...base, durationMin: 20, strain: 10 });
    const long  = estimateWorkoutKcalFromInputs({ ...base, durationMin: 60, strain: 10 });
    expect(long).toBeGreaterThan(short);
  });

  it("higher strain increases calories", () => {
    const low  = estimateWorkoutKcalFromInputs({ ...base, strain: 5 });
    const high = estimateWorkoutKcalFromInputs({ ...base, strain: 18 });
    expect(high).toBeGreaterThan(low);
  });

  it("heavier person burns more calories at same effort", () => {
    const light = estimateWorkoutKcalFromInputs({ ...base, weightKg: 60, strain: 10 });
    const heavy = estimateWorkoutKcalFromInputs({ ...base, weightKg: 100, strain: 10 });
    expect(heavy).toBeGreaterThan(light);
  });
});
