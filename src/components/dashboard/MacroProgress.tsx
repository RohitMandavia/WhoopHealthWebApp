"use client";

import { useEffect, useState } from "react";
import { calcMacroTargets, type Mode, type MacroTargets } from "@/lib/macros";
import type { FoodItem, WhoopDaily } from "@/types";

interface Props {
  items: FoodItem[];
  date: string;
  userId: string;
}

interface Stats {
  weightLbs: number | null;
  bodyFatPct: number | null;
  mode: string | null;
}

function calcBMR(weightLbs: number, bodyFatPct: number): number {
  const weightKg = weightLbs * 0.453592;
  const lbmKg = weightKg * (1 - bodyFatPct / 100);
  return Math.round(370 + 21.6 * lbmKg);
}

function estimateWorkoutKcal(workout: WhoopDaily["workouts"][number], weightKg: number, age: number): number {
  const durationMin = (new Date(workout.end).getTime() - new Date(workout.start).getTime()) / 60000;
  if (durationMin <= 0) return 0;
  if (workout.avgHeartRate != null) {
    const calPerMin = (-37.75 + 0.539 * workout.avgHeartRate + 0.036 * weightKg + 0.138 * age) / 4.184;
    return Math.max(0, Math.round(calPerMin * durationMin));
  }
  const met = 3 + (workout.strain ?? 5) * 0.43;
  return Math.round(met * weightKg * (durationMin / 60));
}

interface BarProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  decimals?: number;
}

function MacroBar({ label, current, target, unit, decimals = 0 }: BarProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = target > 0 && current > target * 1.05;
  const near = target > 0 && current >= target * 0.9 && current <= target * 1.05;

  const barColor = over ? "bg-destructive" : near ? "bg-green-500" : "bg-primary";
  const fmt = (n: number) => decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {fmt(current)}<span className="text-muted-foreground/60"> / {fmt(target)} {unit}</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MacroProgress({ items, date, userId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [whoop, setWhoop] = useState<WhoopDaily | null>(null);

  useEffect(() => {
    function fetchStats() {
      fetch("/api/user/stats")
        .then((r) => r.json())
        .then((d) => setStats(d.stats ?? null));
    }
    fetchStats();
    window.addEventListener("stats-updated", fetchStats);
    return () => window.removeEventListener("stats-updated", fetchStats);
  }, []);

  useEffect(() => {
    fetch(`/api/user/steps?date=${date}`)
      .then((r) => r.json())
      .then((d) => setSteps(d.steps ?? null));
  }, [date]);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/whoop/daily?date=${date}&userId=${userId}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setWhoop(d); })
      .catch(() => {});
  }, [date, userId]);

  if (!stats?.weightLbs || !stats?.bodyFatPct || !stats?.mode) return null;

  const mode = stats.mode as Mode;
  const weightKg = stats.weightLbs * 0.453592;
  const bmr = calcBMR(stats.weightLbs, stats.bodyFatPct);
  const stepKcal = steps != null ? Math.round(steps * weightKg * 0.0006) : 0;
  const workoutKcal = whoop?.workouts.reduce(
    (sum, w) => sum + estimateWorkoutKcal(w, weightKg, 30),
    0
  ) ?? 0;
  const tdee = Math.round(bmr * 1.2) + stepKcal + workoutKcal;
  const targets: MacroTargets = calcMacroTargets(tdee, stats.weightLbs, mode);

  const current = {
    kcal: items.reduce((s, i) => s + i.calories, 0),
    protein: items.reduce((s, i) => s + i.protein, 0),
    carbs: items.reduce((s, i) => s + i.carbs, 0),
    fat: items.reduce((s, i) => s + i.fat, 0),
  };

  const modeLabel: Record<Mode, string> = { cutting: "Cutting", maintenance: "Maintenance", bulking: "Bulking" };
  const modeColor: Record<Mode, string> = { cutting: "text-blue-500", maintenance: "text-green-500", bulking: "text-orange-500" };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Daily Goals</h3>
        <span className={`text-xs font-medium ${modeColor[mode]}`}>{modeLabel[mode]}</span>
      </div>

      <MacroBar label="Calories" current={current.kcal} target={targets.kcal} unit="kcal" />
      <MacroBar label="Protein" current={current.protein} target={targets.protein} unit="g" decimals={1} />
      <MacroBar label="Carbs" current={current.carbs} target={targets.carbs} unit="g" decimals={1} />
      <MacroBar label="Fat" current={current.fat} target={targets.fat} unit="g" decimals={1} />
    </div>
  );
}
