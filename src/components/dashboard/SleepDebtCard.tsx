"use client";

import { useEffect, useState } from "react";

interface DayEntry {
  date: string;
  sleepHours: number | null;
}

interface SleepHistory {
  goalHours: number;
  days: DayEntry[];
  avgHours: number | null;
  debtHours: number;
}

interface Props {
  userId: string;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const C = {
  green:  "#4ade80",
  yellow: "#facc15",
  red:    "#f87171",
  goal:   "#818cf8",
  empty:  "rgba(255,255,255,0.06)",
  label:  "#6b7280",
};

function debtColor(debtHours: number): string {
  if (debtHours <= 0) return C.green;
  if (debtHours <= 2) return C.yellow;
  return C.red;
}

function MiniBarChart({ days, goalHours }: { days: DayEntry[]; goalHours: number }) {
  const W = 280;
  const H = 52;
  const LABEL_H = 12;
  const TOTAL_H = H + LABEL_H;
  const count = days.length;
  const gap = 5;
  const barW = (W - (count - 1) * gap) / count;

  const maxSleep = Math.max(...days.map((d) => d.sleepHours ?? 0), goalHours + 0.5);
  const yMax = maxSleep + 0.5;

  const toY = (h: number) => H * (1 - h / yMax);
  const goalY = toY(goalHours);

  return (
    <svg viewBox={`0 0 ${W} ${TOTAL_H}`} width="100%" style={{ overflow: "visible" }}>
      {/* Goal line */}
      <line
        x1={0} y1={goalY} x2={W} y2={goalY}
        stroke={C.goal} strokeWidth={1} strokeDasharray="4 2" opacity={0.6}
      />

      {days.map((d, i) => {
        const x = i * (barW + gap);
        const barH = d.sleepHours != null ? H * (d.sleepHours / yMax) : 0;
        const y = H - barH;
        const color = d.sleepHours == null ? C.empty : d.sleepHours >= goalHours ? C.green : C.red;
        const dayLabel = DAY_LABELS[new Date(d.date + "T12:00:00Z").getUTCDay()];

        return (
          <g key={d.date}>
            {/* Background track */}
            <rect x={x} y={0} width={barW} height={H} rx={2} fill={C.empty} />
            {/* Sleep bar */}
            {d.sleepHours != null && d.sleepHours > 0 && (
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={color} opacity={0.85} />
            )}
            {/* Day label */}
            <text
              x={x + barW / 2}
              y={H + LABEL_H - 1}
              textAnchor="middle"
              fontSize={8}
              fill={C.label}
            >
              {dayLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function SleepDebtCard({ userId }: Props) {
  const [data, setData] = useState<SleepHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/whoop/sleep-history?userId=${userId}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && !d.error) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || !data) return null;

  const color = debtColor(data.debtHours);
  const caughtUp = data.debtHours <= 0;

  return (
    <div className="rounded-lg border border-l-4 border-l-purple-500/60 bg-purple-500/5 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">Sleep Debt</p>
          <p className="text-xs text-muted-foreground">7-day rolling</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold leading-tight" style={{ color }}>
            {caughtUp ? "Caught up!" : `${data.debtHours.toFixed(1)} hrs behind`}
          </p>
          {data.avgHours != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              avg {data.avgHours}h / {data.goalHours}h goal
            </p>
          )}
        </div>
      </div>

      <MiniBarChart days={data.days} goalHours={data.goalHours} />
    </div>
  );
}
