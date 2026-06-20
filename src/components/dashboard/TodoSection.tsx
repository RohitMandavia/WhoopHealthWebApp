"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

interface Todo {
  id: string;
  text: string;
  done: boolean;
  sortOrder: number;
}

interface TodoSectionProps {
  userId: string;
  isOwner: boolean;
}

export default function TodoSection({ userId, isOwner }: TodoSectionProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/todos?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setTodos(d.todos ?? []));
  }, [userId]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  async function addTodo() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const { todo } = await res.json();
    setTodos((prev) => [...prev, todo]);
    inputRef.current?.focus();
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

  async function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/todos/${id}`, { method: "DELETE" });
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

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragFrom(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== index) setDragOver(index);
  }

  async function handleDrop(index: number) {
    if (dragFrom === null || dragFrom === index) {
      setDragFrom(null);
      setDragOver(null);
      return;
    }
    const reordered = [...todos];
    const [moved] = reordered.splice(dragFrom, 1);
    reordered.splice(index, 0, moved);
    setTodos(reordered);
    setDragFrom(null);
    setDragOver(null);
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

  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">To-Do</h3>
        {done.length > 0 && isOwner && (
          <button
            onClick={async () => {
              const ids = done.map((t) => t.id);
              setTodos((prev) => prev.filter((t) => !t.done));
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

      {todos.length > 0 && (
        <ul className="space-y-0.5">
          {todos.map((todo, i) => {
            const isDragging = dragFrom === i;
            const isOver = dragOver === i && dragFrom !== i;

            return (
              <li
                key={todo.id}
                draggable={isOwner && editingId !== todo.id}
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={[
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                  isDragging ? "opacity-40" : "",
                  isOver ? "ring-1 ring-primary/60 bg-primary/5" : "hover:bg-muted/40",
                ].join(" ")}
              >
                {isOwner && (
                  <span className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0 touch-none" title="Drag to reorder">
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
          })}
        </ul>
      )}

      {done.length > 0 && pending.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {done.length} of {todos.length} completed
        </p>
      )}
    </div>
  );
}
