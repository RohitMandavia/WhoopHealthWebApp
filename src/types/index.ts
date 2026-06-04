export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  caffeineMg?: number; // only present for caffeinated items
}

export interface FoodLog {
  id: string;
  date: string;
  rawInput: string;
  items: FoodItem[];
  createdAt: string;
}

export interface Workout {
  sportName: string;
  start: string;
  end: string;
  kilocalories: number | null;
  strain: number | null;
  avgHeartRate: number | null;
}

export interface DailyCycle {
  strain: number | null;
  kilocalories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
}

export interface Recovery {
  score: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
  spo2: number | null;
  skinTempCelsius: number | null;
}

export interface Sleep {
  durationHours: number | null;
  performancePct: number | null;
  efficiencyPct: number | null;
  consistencyPct: number | null;
  respiratoryRate: number | null;
  remMins: number | null;
  deepMins: number | null;
  lightMins: number | null;
  awakeMins: number | null;
}

export interface FoodPreset {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sortOrder: number;
}

export interface WhoopDaily {
  cycle: DailyCycle | null;
  recovery: Recovery | null;
  sleep: Sleep | null;
  workouts: Workout[];
}
