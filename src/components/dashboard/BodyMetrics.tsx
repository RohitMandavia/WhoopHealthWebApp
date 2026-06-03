"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WhoopDaily } from "@/types";
import type { Mode } from "@/lib/macros";
import WeightChart from "./WeightChart";

interface Stats {
  weightLbs: number | null;
  heightIn: number | null;
  age: number | null;
  bodyFatPct: number | null;
  mode: string | null;
  goalRate: number | null;
  targetWeightLbs: number | null;
  sleepGoalHours: number | null;
}

interface TDEEResult {
  kcal: number;
  bmr: number;
  stepKcal: number | null;  // null = no steps, fell back to 1.2 multiplier
  workoutKcal: number;
}

function estimateWorkoutKcal(workout: WhoopDaily["workouts"][number], weightKg: number, age: number): number {
  const durationMin = (new Date(workout.end).getTime() - new Date(workout.start).getTime()) / 60000;
  if (durationMin <= 0) return 0;

  if (workout.avgHeartRate != null) {
    // Keytel et al. — average of male/female coefficients for a sex-agnostic estimate
    const calPerMin = (-37.75 + 0.539 * workout.avgHeartRate + 0.036 * weightKg + 0.138 * age) / 4.184;
    return Math.max(0, Math.round(calPerMin * durationMin));
  }

  // Fallback: map Whoop strain (0–21) to an approximate MET value (3–12)
  const met = 3 + (workout.strain ?? 5) * 0.43;
  return Math.round(met * weightKg * (durationMin / 60));
}

function calcTDEE(stats: Stats, steps: number | null, whoop: WhoopDaily | null): TDEEResult | null {
  if (stats.weightLbs == null || stats.bodyFatPct == null) return null;

  const weightKg = stats.weightLbs * 0.453592;
  const lbmKg = weightKg * (1 - stats.bodyFatPct / 100);
  const bmr = Math.round(370 + 21.6 * lbmKg);
  const age = stats.age ?? 30;

  const workoutKcal = whoop?.workouts.reduce(
    (sum, w) => sum + estimateWorkoutKcal(w, weightKg, age),
    0
  ) ?? 0;

  const stepKcal = steps != null ? Math.round(steps * weightKg * 0.0006) : null;

  return {
    kcal: Math.round(bmr * 1.2) + (stepKcal ?? 0) + workoutKcal,
    bmr,
    stepKcal,
    workoutKcal,
  };
}

function inchesToFtIn(totalIn: number) {
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return { ft, inches };
}

interface BodyMetricsProps {
  date: string;
  userId: string;
  isOwner?: boolean;
}

export default function BodyMetrics({ date, userId, isOwner = true }: BodyMetricsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [whoop, setWhoop] = useState<WhoopDaily | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [sleepDebt, setSleepDebt] = useState<number | null>(null);
  const [stepInput, setStepInput] = useState("");
  const [savingSteps, setSavingSteps] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ weightLbs: "", ft: "", inches: "", age: "", bodyFatPct: "", targetWeightLbs: "", sleepGoalHours: "8" });
  const [saving, setSaving] = useState(false);

  async function handleSetMode(mode: Mode) {
    setStats((s) => s ? { ...s, mode } : s);
    await fetch("/api/user/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    window.dispatchEvent(new CustomEvent("stats-updated"));
  }

  async function handleSetGoalRate(goalRate: number) {
    setStats((s) => s ? { ...s, goalRate } : s);
    await fetch("/api/user/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalRate }),
    });
    window.dispatchEvent(new CustomEvent("stats-updated"));
  }

  useEffect(() => {
    fetch(`/api/user/stats?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats ?? { weightLbs: null, heightIn: null, age: null, bodyFatPct: null });
      });

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/whoop/sleep-history?userId=${userId}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && !d.error) setSleepDebt(d.debtHours ?? 0); })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/whoop/daily?date=${date}&userId=${userId}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setWhoop(d); })
      .catch(() => {});
  }, [date, userId]);

  useEffect(() => {
    fetch(`/api/user/steps?date=${date}&userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setSteps(d?.steps ?? null);
        setStepInput(d?.steps != null ? String(d.steps) : "");
      })
      .catch(() => setSteps(null));
  }, [date, userId]);

  async function handleSaveSteps() {
    setSavingSteps(true);
    const parsed = stepInput.trim() ? parseInt(stepInput, 10) : null;
    const res = await fetch("/api/user/steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, steps: parsed }),
    });
    const { steps: saved } = await res.json();
    setSteps(saved);
    setSavingSteps(false);
    window.dispatchEvent(new CustomEvent("stats-updated"));
  }

  function openEdit() {
    if (!stats) return;
    const { ft, inches } = stats.heightIn != null ? inchesToFtIn(stats.heightIn) : { ft: "", inches: "" };
    setForm({
      weightLbs: stats.weightLbs != null ? String(stats.weightLbs) : "",
      ft: ft !== "" ? String(ft) : "",
      inches: inches !== "" ? String(inches) : "",
      age: stats.age != null ? String(stats.age) : "",
      bodyFatPct: stats.bodyFatPct != null ? String(stats.bodyFatPct) : "",
      targetWeightLbs: stats.targetWeightLbs != null ? String(stats.targetWeightLbs) : "",
      sleepGoalHours: stats.sleepGoalHours != null ? String(stats.sleepGoalHours) : "8",
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    const heightIn = form.ft || form.inches
      ? (Number(form.ft || 0) * 12) + Number(form.inches || 0)
      : null;

    const body = {
      weightLbs: form.weightLbs ? Number(form.weightLbs) : null,
      heightIn,
      age: form.age ? Number(form.age) : null,
      bodyFatPct: form.bodyFatPct ? Number(form.bodyFatPct) : null,
      targetWeightLbs: form.targetWeightLbs ? Number(form.targetWeightLbs) : null,
      sleepGoalHours: Number(form.sleepGoalHours) || 8,
    };

    const res = await fetch("/api/user/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const { stats: updated } = await res.json();
    setStats(updated);
    setEditing(false);
    setSaving(false);
  }

  if (!stats && !editing) return <div className="h-6" />;

  const heightDisplay = stats?.heightIn != null
    ? (() => { const { ft, inches } = inchesToFtIn(stats.heightIn); return `${ft}'${inches}"`; })()
    : "—";

  const tdee = stats ? calcTDEE(stats, steps, whoop) : null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Body Metrics</h2>
        {!editing && isOwner && (
          <button
            onClick={openEdit}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Weight (lbs)</span>
              <input
                type="number"
                step="0.1"
                placeholder="175"
                value={form.weightLbs}
                onChange={(e) => setForm((f) => ({ ...f, weightLbs: e.target.value }))}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Height</span>
              <div className="flex gap-1 items-center">
                <input
                  type="number"
                  placeholder="5"
                  value={form.ft}
                  onChange={(e) => setForm((f) => ({ ...f, ft: e.target.value }))}
                  className="w-14 rounded border border-input bg-background px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-muted-foreground">ft</span>
                <input
                  type="number"
                  placeholder="10"
                  value={form.inches}
                  onChange={(e) => setForm((f) => ({ ...f, inches: e.target.value }))}
                  className="w-14 rounded border border-input bg-background px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-muted-foreground">in</span>
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Age</span>
              <input
                type="number"
                placeholder="28"
                value={form.age}
                onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Body Fat (%)</span>
              <input
                type="number"
                step="0.1"
                placeholder="18"
                value={form.bodyFatPct}
                onChange={(e) => setForm((f) => ({ ...f, bodyFatPct: e.target.value }))}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Target Weight (lbs)</span>
            <input
              type="number"
              step="0.1"
              placeholder="155"
              value={form.targetWeightLbs}
              onChange={(e) => setForm((f) => ({ ...f, targetWeightLbs: e.target.value }))}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Sleep Goal (hrs/night)</span>
            <div className="flex rounded-md border border-input overflow-hidden w-fit text-xs font-medium">
              {[7, 7.5, 8, 8.5, 9].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, sleepGoalHours: String(h) }))}
                  className={`px-2.5 py-1.5 border-r border-input last:border-r-0 transition-colors ${
                    form.sleepGoalHours === String(h)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Static metrics row */}
          <div className="grid grid-cols-4 gap-4">
            <Metric label="Weight" value={stats?.weightLbs != null ? `${stats.weightLbs} lbs` : "—"} />
            <Metric label="Height" value={heightDisplay} />
            <Metric label="Age" value={stats?.age != null ? `${stats.age} yrs` : "—"} />
            <Metric label="Body Fat" value={stats?.bodyFatPct != null ? `${stats.bodyFatPct}%` : "—"} />
            {stats?.targetWeightLbs != null && (
              <Metric label="Target" value={`${stats.targetWeightLbs} lbs`} />
            )}
            <div>
              <p className="text-xs text-muted-foreground">Sleep Goal</p>
              <p className="text-sm font-medium mt-0.5">{stats?.sleepGoalHours ?? 8}h</p>
              {sleepDebt !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sleepDebt > 0
                    ? `${Math.min(Math.round((( stats?.sleepGoalHours ?? 8) + sleepDebt) * 10) / 10, 10)}h tonight`
                    : "caught up"}
                </p>
              )}
            </div>
          </div>

          {/* Goal — interactive toggle for owner, static badge for friend */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1.5">Goal</p>
            {isOwner ? (
              <div className="flex rounded-md border border-input overflow-hidden w-fit text-xs font-medium">
                {(["cutting", "maintenance", "bulking"] as Mode[]).map((m) => {
                  const active = stats?.mode === m;
                  const colors = {
                    cutting:     active ? "bg-blue-500 text-white"    : "text-muted-foreground hover:text-foreground",
                    maintenance: active ? "bg-green-500 text-white"   : "text-muted-foreground hover:text-foreground",
                    bulking:     active ? "bg-orange-500 text-white"  : "text-muted-foreground hover:text-foreground",
                  };
                  return (
                    <button
                      key={m}
                      onClick={() => handleSetMode(m)}
                      className={`px-3 py-1.5 capitalize transition-colors ${colors[m]} border-r border-input last:border-r-0`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className={`text-xs font-medium capitalize ${
                stats?.mode === "cutting" ? "text-blue-500" :
                stats?.mode === "bulking" ? "text-orange-500" : "text-green-500"
              }`}>
                {stats?.mode ?? "—"}
              </span>
            )}

            {/* Goal rate — only for cutting/bulking */}
            {(stats?.mode === "cutting" || stats?.mode === "bulking") && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1.5">
                  Rate ({stats.mode === "cutting" ? "deficit" : "surplus"})
                </p>
                {isOwner ? (
                  <div className="flex rounded-md border border-input overflow-hidden w-fit text-xs font-medium">
                    {([0.5, 1] as const).map((rate) => {
                      const active = (stats?.goalRate ?? 1) === rate;
                      return (
                        <button
                          key={rate}
                          onClick={() => handleSetGoalRate(rate)}
                          className={`px-3 py-1.5 transition-colors border-r border-input last:border-r-0 ${
                            active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {rate === 0.5 ? "½ lb/wk" : "1 lb/wk"}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {(stats?.goalRate ?? 1) === 0.5 ? "½ lb/wk" : "1 lb/wk"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Steps + TDEE row */}
          <div className="pt-2 border-t grid grid-cols-2 gap-4 items-start">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Steps today</p>
              {isOwner ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="10000"
                    value={stepInput}
                    onChange={(e) => setStepInput(e.target.value)}
                    onBlur={handleSaveSteps}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveSteps(); }}
                    disabled={savingSteps}
                    className="w-28 rounded border border-input bg-background px-2 py-1 text-sm"
                  />
                  {steps != null && (
                    <span className="text-xs text-muted-foreground">{steps.toLocaleString()}</span>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium">{steps != null ? steps.toLocaleString() : "—"}</p>
              )}
            </div>

            {/* TDEE */}
            {tdee && (
              <div>
                <p className="text-xs text-muted-foreground">Est. TDEE</p>
                <p className="text-sm font-semibold mt-0.5">{tdee.kcal.toLocaleString()} kcal</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  BMR {tdee.bmr.toLocaleString()} × 1.2
                  {tdee.stepKcal != null && ` + ${tdee.stepKcal.toLocaleString()} steps`}
                  {tdee.workoutKcal > 0 && ` + ${tdee.workoutKcal.toLocaleString()} workout`}
                </p>
              </div>
            )}
          </div>

          {/* Weight chart */}
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Weight</p>
            <WeightChart
              date={date}
              userId={userId}
              isOwner={isOwner}
              targetWeight={stats?.targetWeightLbs ?? null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}
