"use client";

import { useState } from "react";

interface Props {
  date: string;
  userId: string;
}

export default function DailySummaryButton({ date, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function handleWrapUp() {
    if (loading) return;
    setLoading(true);
    setError(false);
    setSummary(null);
    try {
      const res = await fetch("/api/daily-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setSummary(data.summary ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <button
          onClick={handleWrapUp}
          disabled={loading}
          className={[
            "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all border",
            loading
              ? "bg-muted text-muted-foreground border-border cursor-wait"
              : summary
              ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/20"
              : "bg-indigo-500/15 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/25 hover:border-indigo-400/60",
          ].join(" ")}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Wrapping up…
            </>
          ) : summary ? (
            <>✓ Refresh day summary</>
          ) : (
            <>✦ Wrap up my day</>
          )}
        </button>
      </div>

      {error && (
        <p className="text-center text-xs text-red-400">Something went wrong. Try again.</p>
      )}

      {summary && (
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Day at a Glance</p>
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{summary}</div>
        </div>
      )}
    </div>
  );
}
