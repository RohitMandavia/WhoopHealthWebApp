"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface Entry { date: string; weightLbs: number }

interface Props {
  date: string;
  userId: string;
  isOwner: boolean;
  currentWeight: number | null; // from UserStats for reference line
}

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
      .then((r) => r.json())
      .then((d) => {
        const data: Entry[] = d.entries ?? [];
        setEntries(data);
        const today = data.find((e) => e.date === date);
        setInput(today ? String(today.weightLbs) : "");
      });
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
    // Refresh entries
    const d = await fetch(`/api/weight?userId=${userId}`).then((r) => r.json());
    setEntries(d.entries ?? []);
    setSaving(false);
  }

  const yMin = entries.length > 1
    ? Math.floor(Math.min(...entries.map((e) => e.weightLbs)) - 2)
    : undefined;
  const yMax = entries.length > 1
    ? Math.ceil(Math.max(...entries.map((e) => e.weightLbs)) + 2)
    : undefined;

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

      {entries.length >= 2 && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={entries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin ?? "auto", yMax ?? "auto"]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickCount={4}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 12,
                }}
                formatter={(v) => [`${v} lbs`, "Weight"]}
                labelFormatter={(d) => typeof d === "string" ? fmtDate(d) : String(d)}
              />
              {currentWeight && (
                <ReferenceLine
                  y={currentWeight}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 2"
                  strokeOpacity={0.4}
                />
              )}
              <Line
                type="monotone"
                dataKey="weightLbs"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {entries.length === 1 && isOwner && (
        <p className="text-xs text-muted-foreground">Log weight on another day to see the trend chart.</p>
      )}
    </div>
  );
}
