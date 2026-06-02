"use client";

import { useEffect, useState } from "react";
import { calcMacroTargets, type Mode, type MacroTargets } from "@/lib/macros";
import type { FoodItem, WhoopDaily } from "@/types";

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

// Blend two hex colors by fraction t ∈ [0, 1]
function blendHex(c1: string, c2: string, t: number): string {
  const p = (c: string, s: number) => parseInt(c.slice(s, s + 2), 16);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(p(c1,1),p(c2,1))},${lerp(p(c1,3),p(c2,3))},${lerp(p(c1,5),p(c2,5))})`;
}

const GRAD_SEGS = 12; // number of arc segments for gradient effect

interface RingProps {
  label: string;
  sublabel?: string;
  current: number;
  target: number;
  unit: string;
  decimals?: number;
  color: string;       // hex color for the base arc
  baseHex: string;     // hex of the base color (for gradient start)
  size: number;
  strokeWidth?: number;
}

function Ring({ label, sublabel, current, target, unit, decimals = 0, color, baseHex, size, strokeWidth = 8 }: RingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const progress = target > 0 ? current / target : 0;
  const over = progress > 1.0;
  // Cap the visible overshoot at one full revolution so it doesn't wrap twice
  const overshootFrac = over ? Math.min(progress - 1, 1) : 0;
  const fmt = (n: number) => decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();

  // Main arc segments: always gradient from baseHex → state color (color prop)
  const mainProgress = Math.min(progress, 1);
  const mainSegs = mainProgress > 0 ? Array.from({ length: GRAD_SEGS }, (_, i) => {
    const segStart = (i / GRAD_SEGS) * mainProgress;
    const segEnd   = Math.min(((i + 1) / GRAD_SEGS) * mainProgress, mainProgress);
    const segLen   = (segEnd - segStart) * circ;
    if (segLen <= 0) return null;
    const t = GRAD_SEGS > 1 ? i / (GRAD_SEGS - 1) : 1;
    return { segLen, dashOffset: circ - segStart * circ, segColor: blendHex(baseHex, color, t), i };
  }).filter(Boolean) : [];

  // Overshoot segments: state color → red, wrapping past 12 o'clock
  const overshootSegs = over ? Array.from({ length: GRAD_SEGS }, (_, i) => {
    const segStart = (i / GRAD_SEGS) * overshootFrac;
    const segEnd   = Math.min(((i + 1) / GRAD_SEGS) * overshootFrac, overshootFrac);
    const segLen   = (segEnd - segStart) * circ;
    if (segLen <= 0) return null;
    const t = GRAD_SEGS > 1 ? i / (GRAD_SEGS - 1) : 1;
    return { segLen, dashOffset: circ - segStart * circ, segColor: blendHex(color, "#f87171", t), i };
  }).filter(Boolean) : [];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.track} strokeWidth={strokeWidth} />

          {/* Main gradient arc — always shown */}
          {mainSegs.map((seg) => seg && (
            <circle key={`m${seg.i}`} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.segColor} strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={`${seg.segLen} ${circ - seg.segLen}`}
              strokeDashoffset={seg.dashOffset}
            />
          ))}
          {/* Round cap at the tip */}
          {mainProgress > 0 && (() => {
            const tipAngle = mainProgress * 2 * Math.PI - Math.PI / 2;
            return <circle cx={cx + r * Math.cos(tipAngle)} cy={cy + r * Math.sin(tipAngle)}
              r={strokeWidth / 2} fill={color} />;
          })()}

          {/* Overshoot arc — wraps past 12 o'clock when over */}
          {overshootSegs.map((seg) => seg && (
            <circle key={`o${seg.i}`} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.segColor} strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={`${seg.segLen} ${circ - seg.segLen}`}
              strokeDashoffset={seg.dashOffset}
            />
          ))}
          {/* Round cap at overshoot tip */}
          {over && overshootFrac > 0 && (() => {
            const tipAngle = overshootFrac * 2 * Math.PI - Math.PI / 2;
            return <circle cx={cx + r * Math.cos(tipAngle)} cy={cy + r * Math.sin(tipAngle)}
              r={strokeWidth / 2} fill="#f87171" />;
          })()}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="font-bold leading-none" style={{ fontSize: size > 90 ? 18 : 12, color: over ? C.red : color }}>
            {fmt(current)}
          </span>
          <span style={{ fontSize: size > 90 ? 10 : 9, color: "#6b7280" }}>{unit}</span>
        </div>
      </div>

      <div className="text-center leading-tight">
        <p style={{ fontSize: size > 90 ? 12 : 10 }} className="font-medium">{label}</p>
        {sublabel && <p style={{ fontSize: 9 }} className="text-muted-foreground">{sublabel}</p>}
        {over && <p style={{ fontSize: 9, color: C.red }} className="font-medium">+{fmt(current - target)} over</p>}
      </div>
    </div>
  );
}

const PARTICLES = ["✨", "🎉", "⭐", "🌟", "✨", "💊"];

interface VitaminButtonProps {
  date: string;
  userId: string;
  isOwner: boolean;
}

function VitaminButton({ date, userId, isOwner }: VitaminButtonProps) {
  const [taken, setTaken] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    fetch(`/api/vitamins?date=${date}&userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTaken(d?.taken ?? false))
      .catch(() => setTaken(false));
  }, [date, userId]);

  async function handleToggle() {
    if (!isOwner || saving || taken === null) return;
    setSaving(true);
    const next = !taken;
    setTaken(next);
    if (next) { setCelebrating(true); setTimeout(() => setCelebrating(false), 900); }
    await fetch("/api/vitamins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, taken: next }),
    });
    setSaving(false);
  }

  if (taken === null) return null;

  return (
    <>
      <style>{`
        @keyframes vitaminPop { 0%{transform:scale(1)} 40%{transform:scale(1.25)} 70%{transform:scale(0.92)} 100%{transform:scale(1)} }
        @keyframes vitaminFloat { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-44px);opacity:0} }
        .vit-pop { animation: vitaminPop 0.4s ease forwards; }
        .vit-particle { position:absolute; pointer-events:none; font-size:12px; animation: vitaminFloat 0.9s ease-out forwards; }
      `}</style>
      <div className="relative flex justify-center">
        <button
          onClick={handleToggle}
          disabled={!isOwner || saving}
          className={[
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
            celebrating ? "vit-pop" : "",
            taken
              ? "bg-green-500/20 text-green-400 border border-green-500/40"
              : isOwner
              ? "bg-muted text-muted-foreground border border-border hover:border-green-500/40 hover:text-green-400"
              : "bg-muted text-muted-foreground border border-border cursor-default",
          ].join(" ")}
        >
          <span>{taken ? "✓" : "○"}</span>
          {taken ? "Vitamins taken" : "Took vitamins"}
        </button>
        {celebrating && PARTICLES.map((emoji, i) => (
          <span key={i} className="vit-particle" style={{ left: `${20 + i * 12}%`, bottom: "50%", animationDelay: `${i * 0.07}s` }}>
            {emoji}
          </span>
        ))}
      </div>
    </>
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
  const workoutKcal = whoop?.workouts.reduce((sum, w) => sum + estimateWorkoutKcal(w, weightKg, 30), 0) ?? 0;
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
    <div className="rounded-lg border bg-card p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Daily Goals</h3>
        <span className={`text-xs font-medium ${modeColor[mode]}`}>{modeLabel[mode]}</span>
      </div>

      {/* Centered large calorie ring */}
      <div className="flex justify-center">
        <Ring
          label="Calories"
          sublabel={`${targets.kcal.toLocaleString()} kcal goal`}
          current={current.kcal} target={targets.kcal} unit="kcal"
          color={calRingColor(calProgress)} baseHex="#818cf8"
          size={148} strokeWidth={12}
        />
      </div>

      {/* 3 macro rings below */}
      <div className="flex justify-around">
        <Ring
          label="Protein" current={current.protein} target={targets.protein} unit="g" decimals={1}
          color={macroRingColor(proteinProgress, calProgress)} baseHex="#f87171"
          size={82}
        />
        <Ring
          label="Carbs" current={current.carbs} target={targets.carbs} unit="g" decimals={1}
          color={macroRingColor(carbProgress, calProgress)} baseHex="#60a5fa"
          size={82}
        />
        <Ring
          label="Fat" current={current.fat} target={targets.fat} unit="g" decimals={1}
          color={macroRingColor(fatProgress, calProgress)} baseHex="#fb923c"
          size={82}
        />
      </div>

      {/* Vitamin toggle */}
      <VitaminButton date={date} userId={userId} isOwner={isOwner} />
    </div>
  );
}
