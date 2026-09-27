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

// Explicit dark-theme colors — CSS variables don't resolve inside Recharts SVG
const COLORS = {
  line:       "#818cf8", // indigo-400
  dot:        "#818cf8",
  tick:       "#6b7280", // gray-500
  tooltip:    "#1e2235", // card background
  border:     "#3f4560", // card border
  reference:  "#6b7280",
};

function fmtDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}

export default function WeightChart({ date, userId, isOwner, targetWeight }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDateState] = useState(""); // "" = automatic window

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

  useEffect(() => {
    fetch(`/api/user/stats?userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setStartDateState(d?.stats?.weightChartStartDate ?? ""))
      .catch(() => {});
  }, [userId]);

  function setStartDate(next: string) {
    setStartDateState(next);
    if (!isOwner) return;
    fetch("/api/user/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightChartStartDate: next || null }),
    });
  }

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
  const chartData: { date: string; weightLbs: number | null }[] = [];
  const cursor = new Date(windowStart + "T12:00:00Z");
  const end    = new Date(windowEnd   + "T12:00:00Z");
  while (cursor <= end) {
    const d = cursor.toISOString().split("T")[0];
    chartData.push({ date: d, weightLbs: entryMap.get(d) ?? null });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Always include the goal weight in the range so its reference line never
  // gets clipped off the edge of the chart.
  const rangeValues = [
    ...entries.filter((e) => e.date >= windowStart).map((e) => e.weightLbs),
    ...(targetWeight != null ? [targetWeight] : []),
  ];
  const yMin = rangeValues.length > 0 ? Math.floor(Math.min(...rangeValues) - 2) : undefined;
  const yMax = rangeValues.length > 0 ? Math.ceil(Math.max(...rangeValues)  + 2) : undefined;

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
          <div className="flex items-center justify-end gap-3">
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
                  formatter={(v) => [`${v} lbs`, "Weight"]}
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
                  stroke={COLORS.line}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.dot, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: COLORS.dot, strokeWidth: 0 }}
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
