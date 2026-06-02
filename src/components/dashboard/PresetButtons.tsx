"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FoodItem, FoodPreset } from "@/types";

interface PresetButtonsProps {
  presets: FoodPreset[];
  currentItems: FoodItem[];
  onItemsUpdated?: (items: FoodItem[]) => void;
  onManage?: () => void;
}

export default function PresetButtons({
  presets,
  currentItems,
  onItemsUpdated,
  onManage,
}: PresetButtonsProps) {
  const [adding, setAdding] = useState<string | null>(null);

  async function handleAdd(preset: FoodPreset) {
    setAdding(preset.id);
    const newItem: FoodItem = {
      name: preset.name,
      quantity: preset.quantity,
      calories: preset.calories,
      protein: preset.protein,
      carbs: preset.carbs,
      fat: preset.fat,
    };
    onItemsUpdated?.([...currentItems, newItem]);
    setAdding(null);
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

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={readOnly || adding === preset.id}
          onClick={() => !readOnly && handleAdd(preset)}
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
  );
}
