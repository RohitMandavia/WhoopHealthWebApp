"use client";

import { useEffect, useState } from "react";

interface Props {
  date: string;
  userId: string;
  isOwner: boolean;
}

export default function VitaminToggle({ date, userId, isOwner }: Props) {
  const [taken, setTaken] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/vitamins?date=${date}&userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTaken(d?.taken ?? false))
      .catch(() => setTaken(false));
  }, [date, userId]);

  async function handleToggle() {
    if (!isOwner || saving || taken === null) return;
    setSaving(true);
    const next = !taken;
    setTaken(next);
    await fetch("/api/vitamins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, taken: next }),
    });
    setSaving(false);
  }

  if (taken === null) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={!isOwner || saving}
      className={[
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        taken
          ? "bg-green-500/20 text-green-400 border border-green-500/40"
          : isOwner
          ? "bg-muted text-muted-foreground border border-border hover:border-green-500/40 hover:text-green-400"
          : "bg-muted text-muted-foreground border border-border cursor-default",
      ].join(" ")}
    >
      <span>{taken ? "✓" : "○"}</span>
      {taken ? "Vitamins taken" : "Take vitamins"}
    </button>
  );
}
