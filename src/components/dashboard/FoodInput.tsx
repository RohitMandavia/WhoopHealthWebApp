"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { FoodLog } from "@/types";

interface FoodInputProps {
  date: string;
  onLogAdded: (log: FoodLog) => void;
}

export default function FoodInput({ date, onLogAdded }: FoodInputProps) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleAnalyze() {
    if (!input.trim()) return;
    setStatus("analyzing");
    setErrorMsg("");

    try {
      const analyzeRes = await fetch("/api/food/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!analyzeRes.ok) {
        setErrorMsg("Could not parse that. Try rephrasing.");
        setStatus("error");
        return;
      }

      const { items } = await analyzeRes.json();

      const saveRes = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rawInput: input, items }),
      });

      if (!saveRes.ok) {
        setErrorMsg("Saved analysis failed. Please try again.");
        setStatus("error");
        return;
      }

      const { log } = await saveRes.json();
      onLogAdded(log);
      setInput("");
      setStatus("idle");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="e.g. 2 eggs, toast with butter, coffee with oat milk, an apple"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        disabled={status === "analyzing"}
        className="resize-none"
      />
      <div className="flex items-center gap-3">
        <Button
          onClick={handleAnalyze}
          disabled={status === "analyzing" || !input.trim()}
        >
          {status === "analyzing" ? "Analyzing…" : "Analyze & Log"}
        </Button>
        {status === "error" && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}
