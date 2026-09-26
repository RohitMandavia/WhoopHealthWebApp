"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, GripVertical } from "lucide-react";

interface Todo {
  id: string;
  text: string;
  done: boolean;
  startDate: string | null; // "YYYY-MM-DD" — not actionable before this date
  sortOrder: number;
  parentId: string | null; // family grouping — one level only, purely organizational
}

interface TodoSectionProps {
  userId: string;
  isOwner: boolean;
}

// Drag-and-drop reordering is scoped to a "group" — either the top-level list
// ("top") or a specific family's children (the parent's id) — so items never
// get dragged between a family and the top level.
interface DragPos {
  group: string;
  index: number;
}

function todayStr() {
  const shifted = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(shifted);
}

function daysUntil(date: string, today: string) {
  const ms = new Date(date + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime();
  return Math.round(ms / 86400000);
}

function formatDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.slice(0, 4) !== todayStr().slice(0, 4) ? { year: "numeric" as const } : {}),
  });
}

// <input type="date"> emits intermediate values while a year is being typed
// ("0002-12-08" on the first keystroke of 2026), so only complete, sane dates
// are ever committed.
function isValidDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1900;
}

function waitLabel(date: string, today: string) {
  const d = daysUntil(date, today);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 30) return `in ${d} days`;
  if (d < 365) return `in ${Math.round(d / 30)} mo`;
  return `in ${(d / 365).toFixed(1)} yr`;
}

export default function TodoSection({ userId, isOwner }: TodoSectionProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dateEditingId, setDateEditingId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<DragPos | null>(null);
  const [dragOver, setDragOver] = useState<DragPos | null>(null);
  const [today, setToday] = useState(todayStr);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputDateRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/todos?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setTodos(d.todos ?? []));
  }, [userId]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (addingSubtaskFor) subtaskRef.current?.focus();
  }, [addingSubtaskFor]);

  // Roll scheduled items into the active list when the real date catches up,
  // even if the tab has been left open across midnight.
  useEffect(() => {
    const t = setInterval(() => setToday(todayStr()), 60_000);
    return () => clearInterval(t);
  }, []);

  async function addTodo() {
    const text = input.trim();
    if (!text) return;
    const raw = inputDateRef.current?.value ?? "";
    const startDate = isValidDate(raw) ? raw : null;
    setInput("");
    if (inputDateRef.current) inputDateRef.current.value = "";
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, startDate }),
    });
    const { todo } = await res.json();
    setTodos((prev) => [...prev, todo]);
    inputRef.current?.focus();
  }

  async function addSubtask(parentId: string) {
    const text = subtaskInput.trim();
    if (!text) { setAddingSubtaskFor(null); return; }
    setSubtaskInput("");
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, parentId }),
    });
    const data = await res.json();
    if (data.todo) setTodos((prev) => [...prev, data.todo]);
    setAddingSubtaskFor(null);
  }

  async function toggleDone(id: string) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const next = !todo.done;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: next } : t)));
    fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
  }

  // Deleting a family's parent ungroups its children (they become standalone
  // top-level tasks) rather than deleting them — matches the server's onDelete:
  // SetNull behavior on Todo.parentId.
  async function deleteTodo(id: string) {
    setTodos((prev) =>
      prev
        .filter((t) => t.id !== id)
        .map((t) => (t.parentId === id ? { ...t, parentId: null } : t))
    );
    fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function ungroupTodo(id: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, parentId: null } : t)));
    fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: null }),
    });
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditText(todo.text);
  }

  async function commitEdit(id: string) {
    const text = editText.trim();
    if (!text) { cancelEdit(); return; }
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    setEditingId(null);
    fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  // Only reached from the explicit ✓ / Enter — browsing months in the native
  // picker fires change/blur events that must never save anything.
  function commitDate(todo: Todo, raw: string) {
    setDateEditingId(null);
    const next = raw === "" ? null : isValidDate(raw) ? raw : todo.startDate;
    if (next !== todo.startDate) setStartDate(todo.id, next);
  }

  async function setStartDate(id: string, startDate: string | null) {
    setDateEditingId(null);
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, startDate } : t)));
    fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate }),
    });
  }

  function handleDragStart(e: React.DragEvent, group: string, index: number) {
    setDragFrom({ group, index });
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, group: string, index: number) {
    if (dragFrom?.group !== group) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver?.group !== group || dragOver?.index !== index) setDragOver({ group, index });
  }

  // Reordering applies within a single group only (the top-level list, or one
  // family's children). `list` is that group's items in their current order.
  async function handleDrop(group: string, index: number, list: Todo[]) {
    if (dragFrom === null || dragFrom.group !== group || dragFrom.index === index) {
      setDragFrom(null);
      setDragOver(null);
      return;
    }
    const reordered = [...list];
    const [moved] = reordered.splice(dragFrom.index, 1);
    reordered.splice(index, 0, moved);
    setDragFrom(null);
    setDragOver(null);
    const reorderedIds = new Set(reordered.map((t) => t.id));
    setTodos((prev) => {
      const withoutGroup = prev.filter((t) => !reorderedIds.has(t.id));
      const renumbered = reordered.map((t, i) => ({ ...t, sortOrder: i }));
      return [...withoutGroup, ...renumbered];
    });
    fetch("/api/todos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((t) => t.id) }),
    });
  }

  function handleDragEnd() {
    setDragFrom(null);
    setDragOver(null);
  }

  const isScheduled = (t: Todo) => !t.done && !!t.startDate && t.startDate > today;

  // Bucketing (active vs. scheduled) is decided by the top-level task only —
  // a family always renders together, wherever its parent lands.
  const topLevel = todos.filter((t) => !t.parentId);
  const childrenOf = (parentId: string) =>
    todos.filter((t) => t.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const active = topLevel.filter((t) => !isScheduled(t));
  const scheduled = topLevel
    .filter(isScheduled)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!));
  const done = todos.filter((t) => t.done);

  function dateControl(todo: Todo) {
    if (!isOwner) return null;
    if (dateEditingId === todo.id) {
      return (
        <span className="flex shrink-0 items-center gap-1">
          <input
            ref={dateInputRef}
            type="date"
            autoFocus
            defaultValue={todo.startDate ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDate(todo, e.currentTarget.value);
              if (e.key === "Escape") setDateEditingId(null);
            }}
            className="rounded border border-input bg-background px-1 py-0.5 text-xs"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commitDate(todo, dateInputRef.current?.value ?? "")}
            title="Save date (Enter)"
            className="rounded px-1 text-xs text-primary hover:bg-primary/10 transition-colors"
          >
            ✓
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setDateEditingId(null)}
            title="Cancel (Esc)"
            className="rounded px-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            ✕
          </button>
        </span>
      );
    }
    if (todo.startDate) {
      const days = daysUntil(todo.startDate, today);
      return (
        <button
          onClick={() => setDateEditingId(todo.id)}
          title="Click to change · clear the date to make it active now"
          className={[
            "shrink-0 rounded px-1.5 py-0.5 text-[11px] tabular-nums transition-colors",
            days > 0
              ? "text-muted-foreground hover:bg-muted"
              : "text-primary hover:bg-primary/10",
          ].join(" ")}
        >
          {formatDate(todo.startDate)}
          {days > 0 && <span className="ml-1 opacity-60">{waitLabel(todo.startDate, today)}</span>}
          {days === 0 && <span className="ml-1 opacity-60">today</span>}
        </button>
      );
    }
    return (
      <button
        onClick={() => setDateEditingId(todo.id)}
        title="Schedule for later"
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
      >
        <CalendarClock size={13} />
      </button>
    );
  }

  function row(todo: Todo, opts: { group?: string; index?: number; list?: Todo[]; dim?: boolean; nested?: boolean } = {}) {
    const { group, index, list, dim, nested } = opts;
    const draggable = isOwner && group !== undefined && index !== undefined && editingId !== todo.id;
    const isDragging = group !== undefined && index !== undefined && dragFrom?.group === group && dragFrom.index === index;
    const isOver = group !== undefined && index !== undefined && dragOver?.group === group && dragOver.index === index && !isDragging;

    return (
      <li
        key={todo.id}
        draggable={draggable}
        onDragStart={draggable ? (e) => handleDragStart(e, group!, index!) : undefined}
        onDragOver={group !== undefined && index !== undefined ? (e) => handleDragOver(e, group, index) : undefined}
        onDrop={group !== undefined && index !== undefined && list ? () => handleDrop(group, index, list) : undefined}
        onDragEnd={draggable ? handleDragEnd : undefined}
        className={[
          "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
          nested ? "ml-5 border-l border-border pl-3" : "",
          isDragging ? "opacity-40" : "",
          dim ? "opacity-60" : "",
          isOver ? "ring-1 ring-primary/60 bg-primary/5" : "hover:bg-muted/40",
        ].join(" ")}
      >
        {isOwner && (
          <span
            className={[
              "shrink-0 touch-none",
              draggable
                ? "cursor-grab text-muted-foreground/40 hover:text-muted-foreground"
                : "text-transparent",
            ].join(" ")}
            title={draggable ? "Drag to reorder" : undefined}
          >
            <GripVertical size={14} />
          </span>
        )}

        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => isOwner && toggleDone(todo.id)}
          disabled={!isOwner}
          className="shrink-0 rounded accent-primary cursor-pointer"
        />

        {editingId === todo.id ? (
          <input
            ref={editRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(todo.id);
              if (e.key === "Escape") cancelEdit();
            }}
            onBlur={() => commitEdit(todo.id)}
            className="flex-1 bg-transparent text-sm focus:outline-none border-b border-primary"
          />
        ) : (
          <span
            className={[
              "flex-1 text-sm select-none",
              todo.done ? "line-through text-muted-foreground" : "",
              isOwner && !todo.done ? "cursor-text" : "",
            ].join(" ")}
            onDoubleClick={() => isOwner && !todo.done && startEdit(todo)}
            title={isOwner && !todo.done ? "Double-click to edit" : undefined}
          >
            {todo.text}
          </span>
        )}

        {dateControl(todo)}

        {isOwner && !nested && (
          <button
            onClick={() => setAddingSubtaskFor(addingSubtaskFor === todo.id ? null : todo.id)}
            title="Add a related task under this one"
            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all text-xs"
          >
            + Subtask
          </button>
        )}

        {isOwner && nested && (
          <button
            onClick={() => ungroupTodo(todo.id)}
            title="Remove from family"
            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all text-[11px]"
          >
            Ungroup
          </button>
        )}

        {isOwner && (
          <button
            onClick={() => deleteTodo(todo.id)}
            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-xs"
            title="Delete"
          >
            ✕
          </button>
        )}
      </li>
    );
  }

  function familyBlock(parent: Todo, opts: { index?: number; group?: string; list?: Todo[]; dim?: boolean }) {
    const kids = childrenOf(parent.id);
    return (
      <div key={parent.id}>
        {row(parent, { group: opts.group, index: opts.index, list: opts.list, dim: opts.dim })}
        {kids.length > 0 && (
          <ul>
            {kids.map((child, i) => row(child, { group: parent.id, index: i, list: kids, dim: opts.dim, nested: true }))}
          </ul>
        )}
        {addingSubtaskFor === parent.id && (
          <div className="ml-5 border-l border-border pl-3 flex items-center gap-2 px-2 py-1">
            <input
              ref={subtaskRef}
              type="text"
              placeholder="Related task…"
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSubtask(parent.id);
                if (e.key === "Escape") { setAddingSubtaskFor(null); setSubtaskInput(""); }
              }}
              onBlur={() => addSubtask(parent.id)}
              className="flex-1 bg-transparent text-sm focus:outline-none border-b border-primary"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">To-Do</h3>
        {done.length > 0 && isOwner && (
          <button
            onClick={async () => {
              const ids = done.map((t) => t.id);
              setTodos((prev) =>
                prev
                  .filter((t) => !t.done)
                  .map((t) => (t.parentId && ids.includes(t.parentId) ? { ...t, parentId: null } : t))
              );
              await Promise.all(ids.map((id) => fetch(`/api/todos/${id}`, { method: "DELETE" })));
            }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear completed ({done.length})
          </button>
        )}
      </div>

      {isOwner && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a task…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            ref={inputDateRef}
            type="date"
            min={today}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            title="Optional: don't surface this until this date"
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={addTodo}
            disabled={!input.trim()}
            className="rounded border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {todos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No tasks yet.</p>
      )}

      {active.length > 0 && (
        <div className="space-y-0.5">
          {active.map((t, i) => familyBlock(t, { group: "top", index: i, list: active }))}
        </div>
      )}

      {scheduled.length > 0 && (
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center gap-2 px-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Scheduled
            </span>
            <span className="text-[11px] text-muted-foreground/60">{scheduled.length}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-0.5">
            {scheduled.map((t) => familyBlock(t, { dim: true }))}
          </div>
        </div>
      )}

      {done.length > 0 && active.length > done.length && (
        <p className="text-xs text-muted-foreground">
          {done.length} of {todos.length} completed
        </p>
      )}
    </div>
  );
}
