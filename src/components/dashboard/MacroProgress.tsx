"use client";

import { useEffect, useState } from "react";
import { calcMacroTargets, type Mode, type MacroTargets } from "@/lib/macros";
import type { FoodItem, WhoopDaily } from "@/types";
import VitaminToggle from "./VitaminToggle";

interface Props {
  items: FoodItem[];
  date: string;
  userId: string;
  isOwner: boolean;
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

// ── Ring colors (explicit hex — CSS vars don't resolve in SVG attributes) ──
const C = {
  green:  "#4ade80",
  yellow: "#facc15",
  red:    "#f87171",
  indigo: "#818cf8",
  track:  "rgba(255,255,255,0.08)",
};

function macroRingColor(macroProgress: number, calProgress: number): string {
  if (calProgress === 0) return macroProgress === 0 ? C.indigo : C.red;
  const ratio = macroProgress / calProgress;
  if (ratio >= 0.8 && ratio <= 1.2) return C.green;
  if (ratio > 1.2) return C.red;
  return C.yellow;
}

function calRingColor(progress: number): string {
  if (progress > 1.05) return C.red;
  if (progress >= 0.9) return C.green;
  return C.indigo;
}

interface RingProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  decimals?: number;
  color: string;
  size?: number;
}

function Ring({ label, current, target, unit, decimals = 0, color, size = 88 }: RingProps) {
  const sw = 8;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const progress = target > 0 ? current / target : 0;
  const clamped = Math.min(progress, 1);
  const over = progress > 1.05;
  const fmt = (n: number) => decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.track} strokeWidth={sw} />
          {/* Progress arc */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - clamped)}
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
          />
          {/* Overshoot tick at 12-o'clock when over */}
          {over && (
            <circle
              cx={size / 2} cy={sw / 2}
              r={sw / 2 - 1}
              fill={C.red}
            />
          )}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold leading-none" style={{ color }}>
            {fmt(current)}
          </span>
          <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{unit}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[9px] text-muted-foreground">{fmt(target)} {unit}</p>
        {over && (
          <p className="text-[9px] font-medium" style={{ color: C.red }}>
            +{fmt(current - target)} over
          </p>
        )}
      </div>
    </div>
  );
}

export default function MacroProgress({ items, date, userId, isOwner }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [whoop, setWhoop] = useState<WhoopDaily | null>(null);

  useEffect(() => {
    function refresh() {
      fetch(`/api/user/stats?userId=${userId}`)
        .then((r) => r.json())
        .then((d) => setStats(d.stats ?? null));

      fetch(`/api/user/steps?date=${date}&userId=${userId}`)
        .then((r) => r.json())
        .then((d) => setSteps(d.steps ?? null));

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      fetch(`/api/whoop/daily?date=${date}&userId=${userId}&tz=${encodeURIComponent(tz)}`)
        .then((r) => r.json())
        .then((d) => { if (!d.error) setWhoop(d); })
        .catch(() => {});
    }

    refresh();
    window.addEventListener("stats-updated", refresh);
    return () => window.removeEventListener("stats-updated", refresh);
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
    kcal:    items.reduce((s, i) => s + i.calories, 0),
    protein: items.reduce((s, i) => s + i.protein, 0),
    carbs:   items.reduce((s, i) => s + i.carbs, 0),
    fat:     items.reduce((s, i) => s + i.fat, 0),
  };

  const calProgress     = targets.kcal    > 0 ? current.kcal    / targets.kcal    : 0;
  const proteinProgress = targets.protein > 0 ? current.protein / targets.protein : 0;
  const carbProgress    = targets.carbs   > 0 ? current.carbs   / targets.carbs   : 0;
  const fatProgress     = targets.fat     > 0 ? current.fat     / targets.fat     : 0;

  const modeLabel: Record<Mode, string> = { cutting: "Cutting", maintenance: "Maintenance", bulking: "Bulking" };
  const modeColor: Record<Mode, string> = { cutting: "text-blue-500", maintenance: "text-green-500", bulking: "text-orange-500" };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Daily Goals</h3>
        <span className={`text-xs font-medium ${modeColor[mode]}`}>{modeLabel[mode]}</span>
      </div>

      <VitaminToggle date={date} userId={userId} isOwner={isOwner} />

      <div className="flex justify-around items-start">
        <Ring
          label="Calories" current={current.kcal} target={targets.kcal} unit="kcal"
          color={calRingColor(calProgress)} size={96}
        />
        <Ring
          label="Protein" current={current.protein} target={targets.protein} unit="g" decimals={1}
          color={macroRingColor(proteinProgress, calProgress)}
        />
        <Ring
          label="Carbs" current={current.carbs} target={targets.carbs} unit="g" decimals={1}
          color={macroRingColor(carbProgress, calProgress)}
        />
        <Ring
          label="Fat" current={current.fat} target={targets.fat} unit="g" decimals={1}
          color={macroRingColor(fatProgress, calProgress)}
        />
      </div>
    </div>
  );
}
