"use client";

import { useEffect, useState } from "react";
import { calcMacroTargets, type Mode, type MacroTargets } from "@/lib/macros";
import { estimateWorkoutKcal } from "./BodyMetrics";
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
  age: number | null;
  sex: string | null;
  mode: string | null;
  goalRate: number | null;
  calGoalOverride: number | null;
  proteinGoalOverride: number | null;
  carbsGoalOverride: number | null;
  fatGoalOverride: number | null;
}

function calcBMR(weightLbs: number, bodyFatPct: number): number {
  const weightKg = weightLbs * 0.453592;
  const lbmKg = weightKg * (1 - bodyFatPct / 100);
  return Math.round(370 + 21.6 * lbmKg);
}


const C = {
  green:  "#4ade80",
  yellow: "#facc15",
  red:    "#f87171",
  indigo: "#818cf8",
  track:  "rgba(255,255,255,0.08)",
};

function macroRingColor(macroProgress: number, calProgress: number, allowOver = false): string {
  if (calProgress === 0) return macroProgress === 0 ? C.indigo : (allowOver ? C.green : C.red);
  const ratio = macroProgress / calProgress;
  if (ratio >= 0.8) return C.green;   // on pace or ahead — always green when allowOver
  if (!allowOver && ratio > 1.2) return C.red;
  return C.yellow;
}

function calRingColor(progress: number): string {
  if (progress > 1.05) return C.red;
  if (progress >= 0.9) return C.green;
  return C.indigo;
}

interface RingProps {
  label: string;
  sublabel?: string;
  current: number;
  target: number;
  unit: string;
  decimals?: number;
  color: string;
  size: number;
  strokeWidth?: number;
  showRemaining?: boolean;
}

function Ring({ label, sublabel, current, target, unit, decimals = 0, color, size, strokeWidth = 8, showRemaining = false }: RingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const progress = target > 0 ? current / target : 0;
  const over = progress > 1.05;
  const fmt = (n: number) => decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.track} strokeWidth={strokeWidth} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - Math.min(progress, 1))}
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
          />
          {over && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.red} strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - Math.min(progress - 1, 1))}
            />
          )}
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
        {showRemaining && !over && current < target && (
          <p style={{ fontSize: 9, color: "#6b7280" }}>
            {fmt(target - current)} {unit} left
          </p>
        )}
        {over && <p style={{ fontSize: 9, color: C.red }} className="font-medium">+{fmt(current - target)} over</p>}
      </div>
    </div>
  );
}

const PARTICLES       = ["✨", "🎉", "⭐", "🌟", "✨", "💊"];
const STRETCH_PARTS   = ["🧘", "⭐", "✨", "💪", "✨", "🌟"];
const WATER_PARTS     = ["💧", "⭐", "✨", "🌊", "✨", "💧"];
const HABIT_PARTS     = ["✨", "⭐", "🎉", "✓", "✨", "⭐"];

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
      <div className="relative">
        <button
          onClick={handleToggle}
          disabled={!isOwner || saving}
          className={[
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
            celebrating ? "vit-pop" : "",
            taken
              ? "bg-green-500/20 text-green-400 border border-green-500/40"
              : isOwner
              ? "bg-red-500/15 text-red-400 border border-red-500/40 hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/10"
              : "bg-red-500/15 text-red-400 border border-red-500/40 cursor-default",
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

interface StretchButtonProps {
  date: string;
  userId: string;
  isOwner: boolean;
}

function StretchButton({ date, userId, isOwner }: StretchButtonProps) {
  const [done, setDone] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    fetch(`/api/stretching?date=${date}&userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setDone(d?.done ?? false))
      .catch(() => setDone(false));
  }, [date, userId]);

  async function handleToggle() {
    if (!isOwner || saving || done === null) return;
    setSaving(true);
    const next = !done;
    setDone(next);
    if (next) { setCelebrating(true); setTimeout(() => setCelebrating(false), 900); }
    await fetch("/api/stretching", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, done: next }),
    });
    setSaving(false);
  }

  if (done === null) return null;

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={!isOwner || saving}
        className={[
          "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
          celebrating ? "vit-pop" : "",
          done
            ? "bg-green-500/20 text-green-400 border border-green-500/40"
            : isOwner
            ? "bg-red-500/15 text-red-400 border border-red-500/40 hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/10"
            : "bg-red-500/15 text-red-400 border border-red-500/40 cursor-default",
        ].join(" ")}
      >
        <span>{done ? "✓" : "○"}</span>
        Stretched today
      </button>
      {celebrating && STRETCH_PARTS.map((emoji, i) => (
        <span key={i} className="vit-particle" style={{ left: `${20 + i * 12}%`, bottom: "50%", animationDelay: `${i * 0.07}s` }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

function WaterButton({ date, userId, isOwner }: StretchButtonProps) {
  const [done, setDone] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    fetch(`/api/water?date=${date}&userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setDone(d?.done ?? false))
      .catch(() => setDone(false));
  }, [date, userId]);

  async function handleToggle() {
    if (!isOwner || saving || done === null) return;
    setSaving(true);
    const next = !done;
    setDone(next);
    if (next) { setCelebrating(true); setTimeout(() => setCelebrating(false), 900); }
    await fetch("/api/water", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, done: next }),
    });
    setSaving(false);
  }

  if (done === null) return null;

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={!isOwner || saving}
        className={[
          "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
          celebrating ? "vit-pop" : "",
          done
            ? "bg-green-500/20 text-green-400 border border-green-500/40"
            : isOwner
            ? "bg-red-500/15 text-red-400 border border-red-500/40 hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/10"
            : "bg-red-500/15 text-red-400 border border-red-500/40 cursor-default",
        ].join(" ")}
      >
        <span>{done ? "✓" : "○"}</span>
        Drank enough water
      </button>
      {celebrating && WATER_PARTS.map((emoji, i) => (
        <span key={i} className="vit-particle" style={{ left: `${20 + i * 12}%`, bottom: "50%", animationDelay: `${i * 0.07}s` }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

interface CustomHabit { id: string; name: string; done: boolean }

interface CustomHabitButtonProps {
  habit: CustomHabit;
  date: string;
  isOwner: boolean;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

function CustomHabitButton({ habit, date, isOwner, onToggle, onDelete }: CustomHabitButtonProps) {
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  async function handleToggle() {
    if (!isOwner || saving) return;
    setSaving(true);
    const next = !habit.done;
    if (next) { setCelebrating(true); setTimeout(() => setCelebrating(false), 900); }
    onToggle(habit.id, next);
    await fetch(`/api/habits/${habit.id}/log`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, done: next }),
    });
    setSaving(false);
  }

  return (
    <div className="relative group">
      <button
        onClick={handleToggle}
        disabled={!isOwner || saving}
        className={[
          "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
          celebrating ? "vit-pop" : "",
          habit.done
            ? "bg-green-500/20 text-green-400 border border-green-500/40"
            : isOwner
            ? "bg-red-500/15 text-red-400 border border-red-500/40 hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/10"
            : "bg-red-500/15 text-red-400 border border-red-500/40 cursor-default",
        ].join(" ")}
      >
        <span>{habit.done ? "✓" : "○"}</span>
        {habit.name}
      </button>
      {isOwner && (
        <button
          onClick={() => onDelete(habit.id)}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-muted border border-border text-muted-foreground hover:text-destructive text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove habit"
        >✕</button>
      )}
      {celebrating && HABIT_PARTS.map((emoji, i) => (
        <span key={i} className="vit-particle" style={{ left: `${20 + i * 12}%`, bottom: "50%", animationDelay: `${i * 0.07}s` }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

export default function MacroProgress({ items, date, userId, isOwner }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [whoop, setWhoop] = useState<WhoopDaily | null>(null);
  const [calOverrides, setCalOverrides] = useState<Record<string, number>>({});
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalForm, setGoalForm] = useState({ kcal: "", protein: "", carbs: "", fat: "" });
  const [habits, setHabits] = useState<CustomHabit[]>([]);
  const [addingHabit, setAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");

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
      fetch(`/api/workout-calories?userId=${userId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.overrides) setCalOverrides(d.overrides); })
        .catch(() => {});
      fetch(`/api/habits?date=${date}&userId=${userId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.habits) setHabits(d.habits); })
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
  const age = stats.age ?? 30;
  const workoutKcal = whoop?.workouts.reduce((sum, w) => sum + (calOverrides[w.start] ?? estimateWorkoutKcal(w, weightKg, age, stats.sex)), 0) ?? 0;
  const tdee = Math.round(bmr * 1.2) + stepKcal + workoutKcal;
  const goalRate = stats.goalRate ?? 1;
  const calculated: MacroTargets = calcMacroTargets(tdee, stats.weightLbs, mode, goalRate);
  const hasOverride = stats.calGoalOverride != null || stats.proteinGoalOverride != null || stats.carbsGoalOverride != null || stats.fatGoalOverride != null;
  const targets: MacroTargets = {
    kcal:    stats.calGoalOverride     ?? calculated.kcal,
    protein: stats.proteinGoalOverride ?? calculated.protein,
    carbs:   stats.carbsGoalOverride   ?? calculated.carbs,
    fat:     stats.fatGoalOverride     ?? calculated.fat,
  };

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

  async function handleSaveGoals() {
    const body = {
      calGoalOverride:     goalForm.kcal    ? parseInt(goalForm.kcal)    : null,
      proteinGoalOverride: goalForm.protein ? parseInt(goalForm.protein) : null,
      carbsGoalOverride:   goalForm.carbs   ? parseInt(goalForm.carbs)   : null,
      fatGoalOverride:     goalForm.fat     ? parseInt(goalForm.fat)     : null,
    };
    await fetch("/api/user/stats", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setStats((s) => s ? { ...s, ...body } : s);
    setEditingGoals(false);
    window.dispatchEvent(new CustomEvent("stats-updated"));
  }

  async function handleResetGoals() {
    const body = { calGoalOverride: null, proteinGoalOverride: null, carbsGoalOverride: null, fatGoalOverride: null };
    await fetch("/api/user/stats", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setStats((s) => s ? { ...s, ...body } : s);
    setEditingGoals(false);
    window.dispatchEvent(new CustomEvent("stats-updated"));
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Daily Goals</h3>
        <div className="flex items-center gap-2">
          {hasOverride && !editingGoals && (
            <button onClick={handleResetGoals} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Reset to auto</button>
          )}
          {isOwner && (
            <button
              onClick={() => { setGoalForm({ kcal: String(targets.kcal), protein: String(targets.protein), carbs: String(targets.carbs), fat: String(targets.fat) }); setEditingGoals((v) => !v); }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {editingGoals ? "Cancel" : "Edit goals"}
            </button>
          )}
          <span className={`text-xs font-medium ${modeColor[mode]}`}>{modeLabel[mode]}{hasOverride ? " · custom" : ""}</span>
        </div>
      </div>

      {editingGoals && (
        <div className="grid grid-cols-4 gap-2">
          {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
            <label key={k} className="space-y-0.5">
              <span className="text-xs text-muted-foreground capitalize">{k === "kcal" ? "Calories" : k}</span>
              <input
                type="number"
                value={goalForm[k]}
                onChange={(e) => setGoalForm((f) => ({ ...f, [k]: e.target.value }))}
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
              />
            </label>
          ))}
          <div className="col-span-4 flex gap-2">
            <button onClick={handleSaveGoals} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">Save</button>
            <button onClick={() => setEditingGoals(false)} className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Centered large calorie ring */}
      <div className="flex justify-center">
        <Ring
          label="Calories"
          sublabel={`${targets.kcal.toLocaleString()} kcal goal`}
          current={current.kcal} target={targets.kcal} unit="kcal"
          color={calRingColor(calProgress)}
          size={148} strokeWidth={12} showRemaining
        />
      </div>

      {/* 3 macro rings below */}
      <div className="flex justify-around">
        <Ring
          label="Protein" current={current.protein} target={targets.protein} unit="g" decimals={1}
          color={macroRingColor(proteinProgress, calProgress, true)}
          size={82} showRemaining
        />
        <Ring
          label="Carbs" current={current.carbs} target={targets.carbs} unit="g" decimals={1}
          color={macroRingColor(carbProgress, calProgress)}
          size={82} showRemaining
        />
        <Ring
          label="Fat" current={current.fat} target={targets.fat} unit="g" decimals={1}
          color={macroRingColor(fatProgress, calProgress)}
          size={82} showRemaining
        />
      </div>

      {/* Habit buttons */}
      <div className="flex flex-wrap gap-2">
        <VitaminButton date={date} userId={userId} isOwner={isOwner} />
        <StretchButton date={date} userId={userId} isOwner={isOwner} />
        <WaterButton date={date} userId={userId} isOwner={isOwner} />
        {habits.map((h) => (
          <CustomHabitButton
            key={h.id}
            habit={h}
            date={date}
            isOwner={isOwner}
            onToggle={(id, done) => setHabits((prev) => prev.map((x) => x.id === id ? { ...x, done } : x))}
            onDelete={async (id) => {
              await fetch(`/api/habits/${id}`, { method: "DELETE" });
              setHabits((prev) => prev.filter((x) => x.id !== id));
            }}
          />
        ))}
        {isOwner && !addingHabit && (
          <button
            onClick={() => setAddingHabit(true)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground border border-dashed border-border hover:text-foreground hover:border-muted-foreground transition-colors"
          >
            + Add habit
          </button>
        )}
        {isOwner && addingHabit && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Habit name"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newHabitName.trim()) {
                  const res = await fetch("/api/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newHabitName.trim() }) });
                  const data = res.ok ? await res.json() : null;
                  if (data?.habit) setHabits((prev) => [...prev, data.habit]);
                  setNewHabitName(""); setAddingHabit(false);
                }
                if (e.key === "Escape") { setAddingHabit(false); setNewHabitName(""); }
              }}
              className="rounded-full border border-input bg-background px-3 py-1.5 text-xs w-36"
            />
            <button
              onClick={async () => {
                if (!newHabitName.trim()) { setAddingHabit(false); return; }
                const res = await fetch("/api/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newHabitName.trim() }) });
                const data = res.ok ? await res.json() : null;
                if (data?.habit) setHabits((prev) => [...prev, data.habit]);
                setNewHabitName(""); setAddingHabit(false);
              }}
              className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs"
            >Add</button>
            <button onClick={() => { setAddingHabit(false); setNewHabitName(""); }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}
