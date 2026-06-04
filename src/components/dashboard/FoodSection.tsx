"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import FoodChat from "./FoodChat";
import FoodTable from "./FoodTable";
import MacroProgress from "./MacroProgress";
import PresetButtons from "./PresetButtons";
import PresetManager from "./PresetManager";
import type { FoodItem, FoodLog, FoodPreset } from "@/types";

interface FoodSectionProps {
  date: string;
  userId: string;
  isOwner: boolean;
}

export default function FoodSection({ date, userId, isOwner }: FoodSectionProps) {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [logId, setLogId] = useState<string | null>(null);
  const [presets, setPresets] = useState<FoodPreset[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [clearing, setClearing] = useState(false);

  const allItems: FoodItem[] = logs.flatMap((l) => l.items);

  useEffect(() => {
    setLogs([]);
    setLogId(null);
    fetch(`/api/food/log?date=${date}&userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        const fetched: FoodLog[] = data.logs ?? [];
        setLogs(fetched);
        setLogId(fetched[0]?.id ?? null);
      });
  }, [date, userId]);

  useEffect(() => {
    fetch(`/api/food/presets?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => setPresets(data.presets ?? []));
  }, [userId]);

  function addQuantities(q1: string, q2: string): string {
    // Try to parse "NUMBER UNIT" — e.g. "2 tablespoons", "1 large", "100"
    const re = /^([\d.]+)\s*(.*)$/;
    const m1 = q1.trim().match(re);
    const m2 = q2.trim().match(re);
    if (m1 && m2 && m1[2].toLowerCase() === m2[2].toLowerCase()) {
      const total = parseFloat(m1[1]) + parseFloat(m2[1]);
      const fmt = total % 1 === 0 ? String(total) : total.toFixed(1);
      return m1[2] ? `${fmt} ${m1[2]}` : fmt;
    }
    return q1; // units differ or unparseable — keep the first
  }

  function mergeItems(items: FoodItem[]): FoodItem[] {
    const seen = new Map<string, FoodItem>();
    for (const item of items) {
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) {
        const ex = seen.get(key)!;
        seen.set(key, {
          ...ex,
          calories:   ex.calories + item.calories,
          protein:    +(ex.protein  + item.protein).toFixed(1),
          carbs:      +(ex.carbs    + item.carbs).toFixed(1),
          fat:        +(ex.fat      + item.fat).toFixed(1),
          quantity:   addQuantities(ex.quantity, item.quantity),
          caffeineMg: (ex.caffeineMg ?? 0) + (item.caffeineMg ?? 0) || undefined,
        });
      } else {
        seen.set(key, { ...item });
      }
    }
    return Array.from(seen.values());
  }

  async function saveItems(items: FoodItem[]) {
    const merged = mergeItems(items);
    if (logId) {
      await fetch(`/api/food/log/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: merged }),
      });
      for (const log of logs.slice(1)) {
        await fetch(`/api/food/log/${log.id}`, { method: "DELETE" });
      }
      setLogs((prev) => [{ ...prev[0], items: merged }]);
    } else {
      const res = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rawInput: "chat", items: merged }),
      });
      const { log } = await res.json();
      setLogId(log.id);
      setLogs([log]);
    }
  }

  async function handleItemsUpdated(items: FoodItem[]) {
    // Compute caffeine delta per item name (handles adding the same item multiple times)
    const oldMgByName = new Map<string, number>();
    for (const item of allItems) {
      const key = item.name.toLowerCase().trim();
      oldMgByName.set(key, (oldMgByName.get(key) ?? 0) + (item.caffeineMg ?? 0));
    }

    const additions: { name: string; mg: number }[] = [];
    for (const item of items) {
      if (!(item.caffeineMg ?? 0)) continue;
      const key = item.name.toLowerCase().trim();
      const delta = (item.caffeineMg ?? 0) - (oldMgByName.get(key) ?? 0);
      if (delta > 0) additions.push({ name: item.name, mg: delta });
    }

    await saveItems(items);

    if (additions.length > 0) {
      await Promise.all(
        additions.map(({ name, mg }) =>
          fetch("/api/caffeine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, mg: Math.round(mg), source: name, time: null }),
          })
        )
      );
    }

    window.dispatchEvent(new CustomEvent("caffeine-updated"));
  }

  async function handleClearAll() {
    if (!confirm("Clear all food entries for this day?")) return;
    setClearing(true);
    await fetch(`/api/food/log?date=${date}`, { method: "DELETE" });
    setLogs([]);
    setLogId(null);
    setClearing(false);
  }

  function handleDeleteLog(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (logId === id) setLogId(null);
  }

  function handleUpdateLog(id: string, items: FoodItem[]) {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, items } : l)));
  }

  return (
    <div className="space-y-4">
      <MacroProgress items={allItems} date={date} userId={userId} isOwner={isOwner} />

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {isOwner ? "Quick Add" : "Presets"}
        </p>
        <PresetButtons
          presets={presets}
          currentItems={allItems}
          onItemsUpdated={isOwner ? handleItemsUpdated : undefined}
          onManage={isOwner ? () => setShowManager((v) => !v) : undefined}
        />
      </div>

      {isOwner && showManager && (
        <PresetManager
          presets={presets}
          onClose={() => setShowManager(false)}
          onPresetsChanged={setPresets}
        />
      )}

      {isOwner && (
        <FoodChat currentItems={allItems} onItemsUpdated={handleItemsUpdated} date={date} />
      )}

      {isOwner && allItems.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:text-destructive"
            onClick={handleClearAll}
            disabled={clearing}
          >
            Clear all
          </Button>
        </div>
      )}

      <FoodTable
        logs={logs}
        onDeleteLog={isOwner ? handleDeleteLog : undefined}
        onUpdateLog={isOwner ? handleUpdateLog : undefined}
      />
    </div>
  );
}
