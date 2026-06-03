"use client";

import { useEffect, useState } from "react";

type ExerciseType = "weight_reps" | "reps" | "time" | "distance";

interface PREntry {
  id: string;
  date: string;
  primaryValue: number;
  secondaryValue: number | null;
  notes: string | null;
}

interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  entries: PREntry[];
}

interface Props {
  userId: string;
  isOwner: boolean;
}

// Epley 1RM estimate
function epley(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function prValue(exercise: Exercise): string | null {
  if (exercise.entries.length === 0) return null;
  const { type, entries } = exercise;

  if (type === "weight_reps") {
    const best = entries.reduce((b, e) => {
      const e1rm = epley(e.primaryValue, e.secondaryValue ?? 1);
      const b1rm = epley(b.primaryValue, b.secondaryValue ?? 1);
      return e1rm > b1rm ? e : b;
    });
    const reps = best.secondaryValue ?? 1;
    return `${best.primaryValue} lbs × ${reps}  ·  est. 1RM ${epley(best.primaryValue, reps)} lbs`;
  }
  if (type === "reps") {
    const best = entries.reduce((b, e) => (e.primaryValue > b.primaryValue ? e : b));
    return `${best.primaryValue} reps`;
  }
  if (type === "time") {
    const best = entries.reduce((b, e) => (e.primaryValue < b.primaryValue ? e : b));
    return formatTime(best.primaryValue);
  }
  if (type === "distance") {
    const best = entries.reduce((b, e) => (e.primaryValue > b.primaryValue ? e : b));
    return `${best.primaryValue.toFixed(2)} mi`;
  }
  return null;
}

const TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: "Weight + Reps",
  reps: "Reps",
  time: "Time",
  distance: "Distance",
};

const todayStr = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleDateString("en-CA");

interface ExerciseRowProps {
  exercise: Exercise;
  isOwner: boolean;
  onDelete: (id: string) => void;
  onEntryAdded: (exerciseId: string, entry: PREntry) => void;
  onEntryDeleted: (exerciseId: string, entryId: string) => void;
}

function ExerciseRow({ exercise, isOwner, onDelete, onEntryAdded, onEntryDeleted }: ExerciseRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: todayStr(), primary: "", secondary: "", notes: "" });

  const pr = prValue(exercise);

  async function handleAddEntry() {
    if (!form.primary || saving) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      exerciseId: exercise.id,
      date: form.date,
      primaryValue: Number(form.primary),
    };
    if (exercise.type === "weight_reps" && form.secondary) {
      body.secondaryValue = Number(form.secondary);
    }
    if (form.notes.trim()) body.notes = form.notes.trim();

    const res = await fetch("/api/prs/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = res.ok ? await res.json() : null;
    if (data?.entry) {
      onEntryAdded(exercise.id, data.entry);
      setForm((f) => ({ ...f, primary: "", secondary: "", notes: "" }));
    }
    setSaving(false);
  }

  async function handleDeleteEntry(entryId: string) {
    await fetch(`/api/prs/entries/${entryId}`, { method: "DELETE" });
    onEntryDeleted(exercise.id, entryId);
  }

  function renderEntryRow(entry: PREntry) {
    const { type } = exercise;
    return (
      <tr key={entry.id} className="border-t border-border/40 text-xs">
        <td className="py-1.5 pr-3 text-muted-foreground">{entry.date}</td>
        {type === "weight_reps" && (
          <>
            <td className="py-1.5 pr-3">{entry.primaryValue} lbs</td>
            <td className="py-1.5 pr-3">{entry.secondaryValue ?? "—"}</td>
            <td className="py-1.5 pr-3 text-muted-foreground">
              {entry.secondaryValue ? `${epley(entry.primaryValue, entry.secondaryValue)} lbs` : "—"}
            </td>
          </>
        )}
        {type === "reps" && <td className="py-1.5 pr-3">{entry.primaryValue}</td>}
        {type === "time" && <td className="py-1.5 pr-3">{formatTime(entry.primaryValue)}</td>}
        {type === "distance" && <td className="py-1.5 pr-3">{entry.primaryValue.toFixed(2)} mi</td>}
        {isOwner && (
          <td className="py-1.5 text-right">
            <button
              onClick={() => handleDeleteEntry(entry.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Delete entry"
            >
              ✕
            </button>
          </td>
        )}
      </tr>
    );
  }

  function renderTableHeader() {
    const { type } = exercise;
    return (
      <tr className="text-xs text-muted-foreground">
        <th className="pb-1.5 pr-3 text-left font-medium">Date</th>
        {type === "weight_reps" && (
          <>
            <th className="pb-1.5 pr-3 text-left font-medium">Weight</th>
            <th className="pb-1.5 pr-3 text-left font-medium">Reps</th>
            <th className="pb-1.5 pr-3 text-left font-medium">Est. 1RM</th>
          </>
        )}
        {type === "reps" && <th className="pb-1.5 pr-3 text-left font-medium">Reps</th>}
        {type === "time" && <th className="pb-1.5 pr-3 text-left font-medium">Time</th>}
        {type === "distance" && <th className="pb-1.5 pr-3 text-left font-medium">Distance</th>}
        {isOwner && <th className="pb-1.5" />}
      </tr>
    );
  }

  function renderAddForm() {
    const { type } = exercise;
    const primaryPlaceholder =
      type === "weight_reps" ? "185" : type === "reps" ? "15" : type === "time" ? "1395" : "1.82";
    const primaryLabel =
      type === "weight_reps" ? "Weight (lbs)" : type === "reps" ? "Reps" : type === "time" ? "Seconds" : "Miles";

    return (
      <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Log entry</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Date</p>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="rounded border border-input bg-background px-2 py-1 text-xs w-32"
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{primaryLabel}</p>
            <input
              type="number"
              step={type === "distance" ? "0.01" : "1"}
              placeholder={primaryPlaceholder}
              value={form.primary}
              onChange={(e) => setForm((f) => ({ ...f, primary: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddEntry(); }}
              className="rounded border border-input bg-background px-2 py-1 text-xs w-24"
            />
          </div>
          {type === "weight_reps" && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Reps</p>
              <input
                type="number"
                step="1"
                placeholder="5"
                value={form.secondary}
                onChange={(e) => setForm((f) => ({ ...f, secondary: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddEntry(); }}
                className="rounded border border-input bg-background px-2 py-1 text-xs w-16"
              />
            </div>
          )}
          <button
            onClick={handleAddEntry}
            disabled={!form.primary || saving}
            className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {type === "time" && (
          <p className="text-xs text-muted-foreground">Enter time in seconds (e.g. 23:15 = 1395)</p>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-border/40 last:border-b-0 py-3">
      {/* Row header */}
      <div
        className="flex items-start justify-between cursor-pointer group"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{exercise.name}</p>
            <span className="text-xs text-muted-foreground hidden sm:inline">{TYPE_LABELS[exercise.type]}</span>
          </div>
          {pr && <p className="text-xs text-muted-foreground mt-0.5">PR: {pr}</p>}
          {!pr && <p className="text-xs text-muted-foreground mt-0.5">No entries yet</p>}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {isOwner && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(exercise.id); }}
              className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 text-xs"
              title="Delete exercise"
            >
              ✕
            </button>
          )}
          <span className="text-muted-foreground text-xs">{expanded ? "▴" : "▾"}</span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3">
          {exercise.entries.length > 0 ? (
            <table className="w-full">
              <thead>{renderTableHeader()}</thead>
              <tbody>{exercise.entries.map(renderEntryRow)}</tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">No entries yet.</p>
          )}
          {isOwner && renderAddForm()}
        </div>
      )}
    </div>
  );
}

export default function PRSection({ userId, isOwner }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ExerciseType>("weight_reps");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/prs/exercises?userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.exercises) setExercises(d.exercises); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function handleAddExercise() {
    if (!newName.trim() || adding) return;
    setAdding(true);
    const res = await fetch("/api/prs/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), type: newType }),
    });
    const data = res.ok ? await res.json() : null;
    if (data?.exercise) {
      setExercises((prev) => [...prev, data.exercise]);
      setNewName("");
      setShowAddForm(false);
    }
    setAdding(false);
  }

  async function handleDeleteExercise(id: string) {
    await fetch(`/api/prs/exercises/${id}`, { method: "DELETE" });
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function handleEntryAdded(exerciseId: string, entry: PREntry) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId ? { ...ex, entries: [entry, ...ex.entries] } : ex
      )
    );
  }

  function handleEntryDeleted(exerciseId: string, entryId: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId ? { ...ex, entries: ex.entries.filter((e) => e.id !== entryId) } : ex
      )
    );
  }

  const TYPES: ExerciseType[] = ["weight_reps", "reps", "time", "distance"];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Personal Records</h3>
        {isOwner && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            + Add exercise
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!loading && exercises.length === 0 && !showAddForm && (
        <p className="text-xs text-muted-foreground">
          {isOwner ? "No exercises yet. Add one to start tracking PRs." : "No exercises tracked yet."}
        </p>
      )}

      {exercises.map((ex) => (
        <ExerciseRow
          key={ex.id}
          exercise={ex}
          isOwner={isOwner}
          onDelete={handleDeleteExercise}
          onEntryAdded={handleEntryAdded}
          onEntryDeleted={handleEntryDeleted}
        />
      ))}

      {showAddForm && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">New exercise</p>
          <input
            type="text"
            placeholder="Exercise name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddExercise(); }}
            autoFocus
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex rounded-md border border-input overflow-hidden w-fit text-xs font-medium">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className={`px-3 py-1.5 border-r border-input last:border-r-0 transition-colors ${
                  newType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddExercise}
              disabled={!newName.trim() || adding}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewName(""); }}
              className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
