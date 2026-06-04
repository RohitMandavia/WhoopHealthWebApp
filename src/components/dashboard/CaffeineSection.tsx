"use client";

import { useEffect, useState } from "react";

interface CaffeineEntry {
  id: string;
  mg: number;
  time: string | null;
  source: string | null;
}

interface Props {
  date: string;
  userId: string;
  isOwner: boolean;
}

interface EntryRowProps {
  entry: CaffeineEntry;
  isOwner: boolean;
  onDelete: (id: string) => void;
  onTimeUpdated: (id: string, time: string | null) => void;
}

function EntryRow({ entry, isOwner, onDelete, onTimeUpdated }: EntryRowProps) {
  const [editingTime, setEditingTime] = useState(false);
  const [timeVal, setTimeVal] = useState(entry.time ?? "");

  async function saveTime() {
    setEditingTime(false);
    const newTime = timeVal || null;
    if (newTime === entry.time) return;
    await fetch(`/api/caffeine/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: newTime }),
    });
    onTimeUpdated(entry.id, newTime);
  }

  return (
    <div className="flex items-center justify-between text-xs group">
      <div className="flex items-center gap-2">
        {editingTime ? (
          <input
            type="time"
            value={timeVal}
            autoFocus
            onChange={(e) => setTimeVal(e.target.value)}
            onBlur={saveTime}
            onKeyDown={(e) => { if (e.key === "Enter") saveTime(); if (e.key === "Escape") setEditingTime(false); }}
            className="rounded border border-input bg-background px-1 py-0.5 text-xs w-24 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50"
          />
        ) : (
          <button
            onClick={() => isOwner && setEditingTime(true)}
            className={`w-10 text-left ${isOwner ? "hover:text-foreground cursor-pointer" : ""} text-muted-foreground`}
            title={isOwner ? "Click to set time" : undefined}
          >
            {entry.time ?? "—"}
          </button>
        )}
        <span className="font-medium">{entry.mg} mg</span>
        {entry.source && <span className="text-muted-foreground">{entry.source}</span>}
      </div>
      {isOwner && (
        <button
          onClick={() => onDelete(entry.id)}
          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function totalColor(mg: number): string {
  if (mg >= 400) return "#f87171"; // red
  if (mg >= 200) return "#facc15"; // yellow
  return "#4ade80";                // green
}

function todayStr() {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleDateString("en-CA");
}

export default function CaffeineSection({ date, userId, isOwner }: Props) {
  const [entries, setEntries] = useState<CaffeineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ mg: "", time: "", source: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function fetchEntries() {
      fetch(`/api/caffeine?date=${date}&userId=${userId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setEntries(d?.entries ?? []))
        .catch(() => {});
    }

    setLoading(true);
    fetchEntries();
    setLoading(false);

    window.addEventListener("caffeine-updated", fetchEntries);
    return () => window.removeEventListener("caffeine-updated", fetchEntries);
  }, [date, userId]);

  async function handleAdd() {
    if (!form.mg || saving) return;
    setSaving(true);
    const res = await fetch("/api/caffeine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        mg: Number(form.mg),
        time: form.time || null,
        source: form.source.trim() || null,
      }),
    });
    const data = res.ok ? await res.json() : null;
    if (data?.entry) {
      setEntries((prev) => [...prev, data.entry]);
      setForm({ mg: "", time: "", source: "" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/caffeine/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const total = entries.reduce((s, e) => s + e.mg, 0);
  const color = totalColor(total);

  // Late caffeine: any entry with a time at or after 14:00
  const lateEntry = entries.find((e) => e.time && e.time >= "14:00");

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Caffeine</h3>
        {total > 0 && (
          <span className="text-sm font-bold" style={{ color }}>{total} mg today</span>
        )}
      </div>

      {lateEntry && (
        <p className="text-xs text-yellow-400/80">
          ⚠ Late caffeine ({lateEntry.time}) may affect your sleep.
        </p>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No caffeine logged yet.</p>
      )}

      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} isOwner={isOwner} onDelete={handleDelete} onTimeUpdated={(id, time) => setEntries((prev) => prev.map((x) => x.id === id ? { ...x, time } : x))} />
          ))}
        </div>
      )}

      {isOwner && (
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Time</p>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="rounded border border-input bg-background px-2 py-1 text-xs w-28 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50"
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">mg</p>
              <input
                type="number"
                placeholder="95"
                value={form.mg}
                onChange={(e) => setForm((f) => ({ ...f, mg: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                className="rounded border border-input bg-background px-2 py-1 text-xs w-20"
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Source</p>
              <input
                type="text"
                placeholder="Coffee"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                className="rounded border border-input bg-background px-2 py-1 text-xs w-28"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!form.mg || saving}
              className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {saving ? "…" : "Add"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Common: coffee 95 mg · espresso shot 63 mg · black tea 47 mg · green tea 28 mg
          </p>
        </div>
      )}
    </div>
  );
}
