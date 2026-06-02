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

  async function saveItems(items: FoodItem[]) {
    if (logId) {
      await fetch(`/api/food/log/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      for (const log of logs.slice(1)) {
        await fetch(`/api/food/log/${log.id}`, { method: "DELETE" });
      }
      setLogs((prev) => [{ ...prev[0], items }]);
    } else {
      const res = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rawInput: "chat", items }),
      });
      const { log } = await res.json();
      setLogId(log.id);
      setLogs([log]);
    }
  }

  async function handleItemsUpdated(items: FoodItem[]) {
    await saveItems(items);
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
        <FoodChat currentItems={allItems} onItemsUpdated={handleItemsUpdated} />
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
