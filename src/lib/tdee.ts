/**
 * Pure TDEE and BMR calculation functions.
 * Extracted from components so they can be unit-tested independently.
 */

// Katch-McArdle: uses lean body mass, so sex-neutral
export function calcBMR(weightLbs: number, bodyFatPct: number): number {
  const weightKg = weightLbs * 0.453592;
  const lbmKg = weightKg * (1 - bodyFatPct / 100);
  return Math.round(370 + 21.6 * lbmKg);
}

export interface TDEEInputs {
  weightLbs: number;
  bodyFatPct: number;
  age?: number;
  steps?: number;
  workoutKcal?: number;
}

export interface TDEEResult {
  bmr: number;
  stepKcal: number;
  workoutKcal: number;
  tdee: number;
}

export function calcTDEE({
  weightLbs,
  bodyFatPct,
  steps = 0,
  workoutKcal = 0,
}: TDEEInputs): TDEEResult {
  const bmr = calcBMR(weightLbs, bodyFatPct);
  const weightKg = weightLbs * 0.453592;
  const stepKcal = Math.round(steps * weightKg * 0.0006);
  const tdee = Math.round(bmr * 1.2) + stepKcal + workoutKcal;
  return { bmr, stepKcal, workoutKcal, tdee };
}

// Keytel et al. workout calorie estimation — sex-specific coefficients
export interface WorkoutInputs {
  durationMin: number;
  avgHeartRate?: number | null;
  strain?: number | null;
  weightKg: number;
  age: number;
  sex?: string | null;
  sportName?: string | null;
}

// Applied to the final estimate to correct for the well-documented tendency
// of HR/strain-based formulas (and wearables) to overestimate calorie burn.
const CONSERVATIVE_FACTOR = 0.85;

// Weight training gets a flat baseline instead of the strain/HR model below,
// which runs far too hot for low-cardio lifting sessions.
const WEIGHT_TRAINING_KCAL_PER_MIN = 5; // ≈300 kcal/hour
const WEIGHT_TRAINING_NOMINAL_HR = 115;

export function estimateWorkoutKcalFromInputs({
  durationMin,
  avgHeartRate,
  strain,
  weightKg,
  age,
  sex,
  sportName,
}: WorkoutInputs): number {
  if (durationMin <= 0) return 0;

  const sport = sportName?.toLowerCase() ?? "";

  // Generic "Activity" entries are too vague to estimate reliably — skip.
  if (sport === "activity") return 0;

  if (sport.includes("weight")) {
    const baseline = WEIGHT_TRAINING_KCAL_PER_MIN * durationMin;
    if (avgHeartRate != null) {
      const hrFactor = Math.min(1.2, Math.max(0.8, avgHeartRate / WEIGHT_TRAINING_NOMINAL_HR));
      return Math.round(baseline * hrFactor);
    }
    return Math.round(baseline);
  }

  const met = 3 + (strain ?? 5) * 0.43;
  const strainEstimate = Math.round(met * weightKg * (durationMin / 60));

  if (avgHeartRate != null) {
    let calPerMin: number;
    if (sex === "male") {
      calPerMin = (-55.0969 + 0.6309 * avgHeartRate + 0.1988 * weightKg + 0.2017 * age) / 4.184;
    } else if (sex === "female") {
      calPerMin = (-20.4022 + 0.4472 * avgHeartRate - 0.1263 * weightKg + 0.074 * age) / 4.184;
    } else {
      calPerMin = (-37.75 + 0.539 * avgHeartRate + 0.036 * weightKg + 0.138 * age) / 4.184;
    }
    const hrEstimate = Math.max(0, Math.round(calPerMin * durationMin));
    return Math.round(((hrEstimate + strainEstimate) / 2) * CONSERVATIVE_FACTOR);
  }

  return Math.round(strainEstimate * CONSERVATIVE_FACTOR);
}
