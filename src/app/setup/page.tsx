"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Mode } from "@/lib/macros";

const MODES: { value: Mode; label: string; description: string }[] = [
  { value: "cutting",     label: "Cutting",     description: "Lose fat, preserve muscle (-500 kcal)" },
  { value: "maintenance", label: "Maintenance",  description: "Stay at current weight (TDEE)" },
  { value: "bulking",     label: "Bulking",      description: "Build muscle with a small surplus (+250 kcal)" },
];

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ weightLbs: "", ft: "", inches: "", age: "", bodyFatPct: "" });
  const [mode, setMode] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = form.weightLbs && form.bodyFatPct && mode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError("");

    const heightIn = form.ft || form.inches
      ? Number(form.ft || 0) * 12 + Number(form.inches || 0)
      : null;

    const res = await fetch("/api/user/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightLbs: Number(form.weightLbs),
        heightIn,
        age: form.age ? Number(form.age) : null,
        bodyFatPct: Number(form.bodyFatPct),
        mode,
      }),
    });

    if (res.ok) {
      const shifted = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const today = shifted.toLocaleDateString("en-CA");
      router.push(`/?date=${today}`);
    } else {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof typeof form, placeholder: string, type = "number") => (
    <label className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        step="0.1"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
          <p className="text-sm text-muted-foreground">We need a few measurements to calculate your targets.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Body metrics */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold">Body Metrics</h2>
            <div className="grid grid-cols-2 gap-3">
              {field("Weight (lbs) *", "weightLbs", "175")}

              <label className="space-y-1">
                <span className="text-sm font-medium">Height</span>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="number"
                    placeholder="5"
                    value={form.ft}
                    onChange={(e) => setForm((f) => ({ ...f, ft: e.target.value }))}
                    className="w-16 rounded-md border border-input bg-background px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">ft</span>
                  <input
                    type="number"
                    placeholder="10"
                    value={form.inches}
                    onChange={(e) => setForm((f) => ({ ...f, inches: e.target.value }))}
                    className="w-16 rounded-md border border-input bg-background px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">in</span>
                </div>
              </label>

              {field("Body Fat % *", "bodyFatPct", "18")}
              {field("Age", "age", "28")}
            </div>
            <p className="text-xs text-muted-foreground">* Required</p>
          </div>

          {/* Goal */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Goal *</h2>
            <div className="space-y-2">
              {MODES.map((m) => {
                const active = mode === m.value;
                const colors: Record<Mode, string> = {
                  cutting:     active ? "border-blue-500 bg-blue-500/10"   : "border-input hover:border-blue-400",
                  maintenance: active ? "border-green-500 bg-green-500/10" : "border-input hover:border-green-400",
                  bulking:     active ? "border-orange-500 bg-orange-500/10" : "border-input hover:border-orange-400",
                };
                const labelColors: Record<Mode, string> = {
                  cutting: "text-blue-500", maintenance: "text-green-500", bulking: "text-orange-500",
                };
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${colors[m.value]}`}
                  >
                    <p className={`text-sm font-medium ${active ? labelColors[m.value] : ""}`}>{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={!canSubmit || saving}>
            {saving ? "Saving…" : "Get started"}
          </Button>
        </form>
      </div>
    </div>
  );
}
