"use client";

import { useState } from "react";

interface Remaining {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Suggestion {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface SuggestResult {
  sweet: Suggestion;
  savory: Suggestion;
  both: Suggestion;
  reply: string;
}

interface Props {
  remaining: Remaining;
}

const CARD_META: Record<keyof Pick<SuggestResult, "sweet" | "savory" | "both">, { label: string; emoji: string }> = {
  sweet:  { label: "Sweet",  emoji: "🍰" },
  savory: { label: "Savory", emoji: "🥑" },
  both:   { label: "Both",   emoji: "🍯" },
};

function SuggestionCard({ kind, suggestion }: { kind: keyof typeof CARD_META; suggestion: Suggestion }) {
  const { label, emoji } = CARD_META[kind];
  return (
    <div className="flex-1 min-w-[140px] rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">{emoji} {label}</p>
      <p className="text-sm font-medium leading-snug">{suggestion.name}</p>
      <p className="text-xs text-muted-foreground leading-snug">{suggestion.description}</p>
      <p className="text-xs text-foreground/70">
        {Math.round(suggestion.calories)} kcal · {suggestion.protein.toFixed(0)}p / {suggestion.carbs.toFixed(0)}c / {suggestion.fat.toFixed(0)}f
      </p>
    </div>
  );
}

export default function FoodSuggestions({ remaining }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [error, setError] = useState(false);

  async function handleSuggest() {
    if (loading) return;
    setLoading(true);
    setError(false);
    setResult(null);
    try {
      const res = await fetch("/api/food/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remaining }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setResult(data);
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
          onClick={handleSuggest}
          disabled={loading}
          className={[
            "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all border",
            loading
              ? "bg-muted text-muted-foreground border-border cursor-wait"
              : result
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
              Thinking of something…
            </>
          ) : result ? (
            <>✓ Suggest something else</>
          ) : (
            <>💡 What should I eat?</>
          )}
        </button>
      </div>

      {error && (
        <p className="text-center text-xs text-red-400">Something went wrong. Try again.</p>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">{result.reply}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <SuggestionCard kind="sweet" suggestion={result.sweet} />
            <SuggestionCard kind="savory" suggestion={result.savory} />
            <SuggestionCard kind="both" suggestion={result.both} />
          </div>
        </div>
      )}
    </div>
  );
}
