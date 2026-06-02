"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface Entry { date: string; weightLbs: number }

interface Props {
  date: string;
  userId: string;
  isOwner: boolean;
  currentWeight: number | null;
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

export default function WeightChart({ date, userId, isOwner, currentWeight }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

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

  // Ensure at least a 7-day window ending on the later of today / last entry
  const windowEnd   = lastEntry  > today       ? lastEntry  : today;
  const minStart    = new Date(new Date(windowEnd).getTime() - 6 * 86400000).toISOString().split("T")[0];
  const windowStart = firstEntry < minStart    ? firstEntry : minStart;

  // Generate every date in the range
  const chartData: { date: string; weightLbs: number | null }[] = [];
  const cursor = new Date(windowStart + "T12:00:00Z");
  const end    = new Date(windowEnd   + "T12:00:00Z");
  while (cursor <= end) {
    const d = cursor.toISOString().split("T")[0];
    chartData.push({ date: d, weightLbs: entryMap.get(d) ?? null });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const actualValues = entries.map((e) => e.weightLbs);
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
              {currentWeight && (
                <ReferenceLine
                  y={currentWeight}
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
      )}

      {entries.length === 0 && isOwner && (
        <p className="text-xs text-muted-foreground">Log your weight to see the trend chart.</p>
      )}
    </div>
  );
}
