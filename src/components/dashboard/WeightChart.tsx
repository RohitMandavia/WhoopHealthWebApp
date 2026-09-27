"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface Entry { date: string; weightLbs: number }

interface Props {
  date: string;
  userId: string;
  isOwner: boolean;
  targetWeight: number | null;
}

// Explicit dark-theme colors — CSS variables don't resolve inside Recharts SVG.
// The moving-average orange is picked to pair with the existing indigo: distinct
// hues on the blue/orange axis, which stays distinguishable under every common
// form of color-vision deficiency (validated via the dataviz skill's palette
// checker — CVD ΔE 28.2, normal-vision ΔE 29.7 against the indigo).
const COLORS = {
  line:       "#818cf8", // indigo-400 — actual logged weight
  dot:        "#818cf8",
  average:    "#d95926", // orange — 7-day moving average
  tick:       "#6b7280", // gray-500
  tooltip:    "#1e2235", // card background
  border:     "#3f4560", // card border
  reference:  "#6b7280",
};

function fmtDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}

// Average of whatever real entries fall in the trailing 7 calendar days
// (inclusive) ending on `d` — not a strict daily rolling average, since
// weigh-ins can have gaps. Null when there's nothing in that window.
function movingAverageAt(d: string, entries: Entry[]): number | null {
  const end = new Date(d + "T12:00:00Z").getTime();
  const start = end - 6 * 86400000;
  const inWindow = entries.filter((e) => {
    const t = new Date(e.date + "T12:00:00Z").getTime();
    return t >= start && t <= end;
  });
  if (inWindow.length === 0) return null;
  return inWindow.reduce((s, e) => s + e.weightLbs, 0) / inWindow.length;
}

export default function WeightChart({ date, userId, isOwner, targetWeight }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(""); // "" = automatic window

  useEffect(() => {
    fetch(`/api/weight?userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const data: Entry[] = d?.entries ?? [];
        setEntries(data);
        const today = data.find((e) => e.date === date);
        setInput(today ? String(today.weightLbs) : "");
      })
      .catch(() => {});
  }, [date, userId]);

  async function handleSave() {
    if (!isOwner || saving) return;
    setSaving(true);
    const val = input.trim() ? parseFloat(input) : null;

    await fetch("/api/weight", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, weightLbs: val }),
    });

    // If logging today's weight, also sync it to UserStats so TDEE stays current
    const today = new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleDateString("en-CA");
    if (date === today && val != null) {
      await fetch("/api/user/stats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightLbs: val }),
      });
      window.dispatchEvent(new CustomEvent("stats-updated"));
    }

    const res = await fetch(`/api/weight?userId=${userId}`);
    const d = res.ok ? await res.json() : null;
    setEntries(d?.entries ?? []);
    setSaving(false);
  }

  // Build a padded date range so:
  // 1. The axis always spans at least 7 days
  // 2. Missing dates show as gaps the line interpolates across (connectNulls)
  const entryMap = new Map(entries.map((e) => [e.date, e.weightLbs]));

  const today = new Date().toISOString().split("T")[0];
  const firstEntry = entries[0]?.date ?? today;
  const lastEntry  = entries[entries.length - 1]?.date ?? today;

  // Ensure at least a 7-day window ending on the later of today / last entry.
  // A manually-picked start date overrides the automatic lower bound.
  const windowEnd   = lastEntry  > today       ? lastEntry  : today;
  const minStart    = new Date(new Date(windowEnd).getTime() - 6 * 86400000).toISOString().split("T")[0];
  const autoStart   = firstEntry < minStart    ? firstEntry : minStart;
  const windowStart = startDate && startDate <= windowEnd ? startDate : autoStart;

  // Generate every date in the range
  const chartData: { date: string; weightLbs: number | null; movingAvg: number | null }[] = [];
  const cursor = new Date(windowStart + "T12:00:00Z");
  const end    = new Date(windowEnd   + "T12:00:00Z");
  while (cursor <= end) {
    const d = cursor.toISOString().split("T")[0];
    chartData.push({ date: d, weightLbs: entryMap.get(d) ?? null, movingAvg: movingAverageAt(d, entries) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const actualValues = [
    ...entries.filter((e) => e.date >= windowStart).map((e) => e.weightLbs),
    ...chartData.map((c) => c.movingAvg).filter((v): v is number => v != null),
  ];
  const yMin = actualValues.length > 0 ? Math.floor(Math.min(...actualValues) - 2) : undefined;
  const yMax = actualValues.length > 0 ? Math.ceil(Math.max(...actualValues)  + 2) : undefined;

  return (
    <div className="space-y-3">
      {isOwner && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Weight today (lbs)</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              placeholder="175"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              disabled={saving}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
            />
            <span className="text-xs text-muted-foreground">lbs</span>
          </div>
        </div>
      )}

      {entries.length >= 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: COLORS.dot }} />
                Weight
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: COLORS.average }} />
                7-day avg
              </span>
            </div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              From
              <input
                type="date"
                value={startDate}
                max={windowEnd}
                onChange={(e) => setStartDate(e.target.value)}
                title="Chart start date — clear to reset to the automatic window"
                className="rounded border border-input bg-background px-1 py-0.5 text-[10px]"
              />
              {startDate && (
                <button
                  onClick={() => setStartDate("")}
                  title="Reset to automatic window"
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </label>
          </div>

          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: COLORS.tick }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[yMin ?? "auto", yMax ?? "auto"]}
                  tick={{ fontSize: 10, fill: COLORS.tick }}
                  tickLine={false}
                  axisLine={false}
                  tickCount={4}
                />
                <Tooltip
                  contentStyle={{
                    background: COLORS.tooltip,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    fontSize: 12,
                    color: "#e5e7eb",
                  }}
                  formatter={(v, name) => [`${typeof v === "number" ? v.toFixed(1) : v} lbs`, name]}
                  labelFormatter={(d) => typeof d === "string" ? fmtDate(d) : String(d)}
                  cursor={{ stroke: COLORS.reference, strokeWidth: 1 }}
                />
                {targetWeight && (
                  <ReferenceLine
                    y={targetWeight}
                    stroke={COLORS.reference}
                    strokeDasharray="4 2"
                    strokeOpacity={0.4}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="weightLbs"
                  name="Weight"
                  stroke={COLORS.line}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.dot, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: COLORS.dot, strokeWidth: 0 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  name="7-day avg"
                  stroke={COLORS.average}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={{ r: 4, fill: COLORS.average, strokeWidth: 0 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {entries.length === 0 && isOwner && (
        <p className="text-xs text-muted-foreground">Log your weight to see the trend chart.</p>
      )}
    </div>
  );
}
