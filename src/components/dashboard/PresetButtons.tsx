"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FoodItem, FoodPreset } from "@/types";

interface PresetButtonsProps {
  presets: FoodPreset[];
  currentItems: FoodItem[];
  onItemsUpdated?: (items: FoodItem[]) => void;
  onManage?: () => void;
}

// Parse "2 cups" → { num: 2, unit: "cups" }. Returns null if no leading number.
function parseQuantity(q: string): { num: number; unit: string } | null {
  const m = q.trim().match(/^([\d.]+)\s*(.*)$/);
  if (!m) return null;
  return { num: parseFloat(m[1]), unit: m[2].trim() };
}

export default function PresetButtons({
  presets,
  currentItems,
  onItemsUpdated,
  onManage,
}: PresetButtonsProps) {
  const [active, setActive] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function needsPrompt(preset: FoodPreset) {
    return preset.quantity === "1 serving";
  }

  function openPreset(preset: FoodPreset) {
    const parsed = parseQuantity(preset.quantity);
    setQtyInput(parsed ? String(parsed.num) : "");
    setActive(preset.id);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleAdd(preset: FoodPreset) {
    const parsed = parseQuantity(preset.quantity);
    let scale = 1;
    let finalQty = preset.quantity;

    if (parsed && qtyInput.trim()) {
      const newNum = parseFloat(qtyInput);
      if (!isNaN(newNum) && newNum > 0) {
        scale = newNum / parsed.num;
        finalQty = parsed.unit ? `${newNum} ${parsed.unit}` : String(newNum);
      }
    }

    const newItem: FoodItem = {
      name: preset.name,
      quantity: finalQty,
      calories: Math.round(preset.calories * scale),
      protein:  Math.round(preset.protein  * scale * 10) / 10,
      carbs:    Math.round(preset.carbs    * scale * 10) / 10,
      fat:      Math.round(preset.fat      * scale * 10) / 10,
      caffeineMg: preset.caffeineMg ? Math.round(preset.caffeineMg * scale) : undefined,
    };

    onItemsUpdated?.([...currentItems, newItem]);
    setActive(null);
    setQtyInput("");
  }

  const readOnly = !onItemsUpdated;

  if (presets.length === 0) {
    if (readOnly) return <p className="text-xs text-muted-foreground">No presets.</p>;
    return (
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">No presets yet.</p>
        <button onClick={onManage} className="text-xs text-primary underline underline-offset-2">
          Add presets
        </button>
      </div>
    );
  }

  const activePreset = presets.find((p) => p.id === active);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            className={`h-7 text-xs ${active === preset.id ? "border-primary text-primary" : ""}`}
            disabled={readOnly}
            onClick={() => {
              if (readOnly) return;
              if (active === preset.id) { setActive(null); return; }
              if (needsPrompt(preset)) {
                openPreset(preset);
              } else {
                handleAdd(preset);
              }
            }}
          >
            {!readOnly && "+ "}{preset.name}
            <span className="ml-1 text-muted-foreground">{preset.calories} cal</span>
          </Button>
        ))}
        {!readOnly && (
          <button
            onClick={onManage}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
          >
            Manage
          </button>
        )}
      </div>

      {activePreset && (
        <div className="flex items-center gap-2 p-2 rounded-md border border-primary/40 bg-primary/5 w-fit">
          <span className="text-xs font-medium">{activePreset.name}</span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="any"
            placeholder="qty"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd(activePreset);
              if (e.key === "Escape") setActive(null);
            }}
            className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
          />
          <button
            onClick={() => handleAdd(activePreset)}
            className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium"
          >
            Add
          </button>
          <button
            onClick={() => setActive(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
