"use client";

import { useEffect, useState } from "react";

interface Props {
  date: string;
  userId: string;
  isOwner: boolean;
}

const PARTICLES = ["✨", "🎉", "⭐", "🌟", "✨", "💊"];

export default function VitaminToggle({ date, userId, isOwner }: Props) {
  const [taken, setTaken] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

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
    if (next) {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 900);
    }
    await fetch("/api/vitamins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, taken: next }),
    });
    setSaving(false);
  }

  if (taken === null) return null;

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-48px) scale(0.6); opacity: 0; }
        }
        @keyframes popBounce {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.25); }
          70%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        .vitamin-pop { animation: popBounce 0.4s ease forwards; }
        .particle { position: absolute; pointer-events: none; font-size: 14px;
          animation: floatUp 0.9s ease-out forwards; }
      `}</style>

      <div className="relative flex justify-center">
        <button
          onClick={handleToggle}
          disabled={!isOwner || saving}
          key={taken ? "taken" : "not-taken"}
          className={[
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
            celebrating ? "vitamin-pop" : "",
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

        {celebrating && PARTICLES.map((emoji, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: `${30 + i * 8}%`,
              bottom: "50%",
              animationDelay: `${i * 0.07}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
    </>
  );
}
