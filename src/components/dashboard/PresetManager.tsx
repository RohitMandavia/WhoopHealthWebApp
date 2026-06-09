"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FoodPreset } from "@/types";

interface PresetManagerProps {
  presets: FoodPreset[];
  onClose: () => void;
  onPresetsChanged: (presets: FoodPreset[]) => void;
}

const EMPTY_FORM = { name: "", quantity: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", sugar: "", addedSugar: "", caffeineMg: "", variableQty: false };

export default function PresetManager({ presets, onClose, onPresetsChanged }: PresetManagerProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function field(key: Exclude<keyof typeof EMPTY_FORM, "variableQty">) {
    return (
      <input
        type={key === "name" || key === "quantity" ? "text" : "number"}
        step="0.1"
        placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="rounded border border-input bg-background px-2 py-1 text-sm w-full"
      />
    );
  }

  function startEdit(preset: FoodPreset) {
    setEditingId(preset.id);
    setForm({
      name: preset.name,
      quantity: preset.quantity,
      calories: String(preset.calories),
      protein: String(preset.protein),
      carbs: String(preset.carbs),
      fat: String(preset.fat),
      fiber: preset.fiber != null ? String(preset.fiber) : "",
      sugar: preset.sugar != null ? String(preset.sugar) : "",
      addedSugar: preset.addedSugar != null ? String(preset.addedSugar) : "",
      caffeineMg: preset.caffeineMg != null ? String(preset.caffeineMg) : "",
      variableQty: preset.variableQty ?? false,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.calories) return;
    setSaving(true);

    const body = {
      name: form.name.trim(),
      quantity: form.quantity.trim() || "1 serving",
      calories: Math.round(Number(form.calories)),
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      fiber: form.fiber ? Number(form.fiber) : null,
      sugar: form.sugar ? Number(form.sugar) : null,
      addedSugar: form.addedSugar ? Number(form.addedSugar) : null,
      caffeineMg: form.caffeineMg ? Math.round(Number(form.caffeineMg)) : null,
      variableQty: form.variableQty,
    };

    if (editingId) {
      const res = await fetch(`/api/food/presets/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { preset } = await res.json();
      onPresetsChanged(presets.map((p) => (p.id === editingId ? preset : p)));
    } else {
      const res = await fetch("/api/food/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { preset } = await res.json();
      onPresetsChanged([...presets, preset]);
    }

    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/food/presets/${id}`, { method: "DELETE" });
    onPresetsChanged(presets.filter((p) => p.id !== id));
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Manage Presets</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕ Close</button>
      </div>

      {/* Existing presets */}
      {presets.length > 0 && (
        <div className="space-y-2">
          {presets.map((preset) =>
            editingId === preset.id ? (
              <div key={preset.id} className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 items-end">
                {field("name")}
                {field("quantity")}
                {field("calories")}
                {field("protein")}
                {field("carbs")}
                {field("fat")}
                {field("fiber")}
                {field("sugar")}
                {field("addedSugar")}
                {field("caffeineMg")}
                <div className="col-span-3 sm:col-span-5 flex items-center gap-2">
                  <input type="checkbox" id="vq-edit" checked={form.variableQty} onChange={(e) => setForm((f) => ({ ...f, variableQty: e.target.checked }))} className="rounded" />
                  <label htmlFor="vq-edit" className="text-xs text-muted-foreground">Ask for quantity when adding (macros scale per the base amount above)</label>
                </div>
                <div className="col-span-3 sm:col-span-5 flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div key={preset.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <div>
                  <span className="font-medium">{preset.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{preset.quantity} · {preset.calories} cal · {preset.protein}g P · {preset.carbs}g C · {preset.fat}g F{preset.caffeineMg ? ` · ${preset.caffeineMg}mg caffeine` : ""}{preset.variableQty ? " · scales" : ""}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(preset)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                  <button onClick={() => handleDelete(preset.id)} className="text-xs text-destructive hover:opacity-80">Delete</button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Add new */}
      {!editingId && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add new preset</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {field("name")}
            {field("quantity")}
            {field("calories")}
            {field("protein")}
            {field("carbs")}
            {field("fat")}
            {field("fiber")}
            {field("sugar")}
            {field("addedSugar")}
            {field("caffeineMg")}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="vq-add" checked={form.variableQty} onChange={(e) => setForm((f) => ({ ...f, variableQty: e.target.checked }))} className="rounded" />
            <label htmlFor="vq-add" className="text-xs text-muted-foreground">Ask for quantity when adding (macros scale per the base amount above)</label>
          </div>
          <p className="text-xs text-muted-foreground">Name · Quantity (base) · Calories · Protein (g) · Carbs (g) · Fat (g) · Fiber (g) · Sugar (g) · Added Sugar (g) · Caffeine (mg) — all optional except name &amp; calories</p>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving || !form.name.trim() || !form.calories}>
            {saving ? "Saving…" : "Add Preset"}
          </Button>
        </div>
      )}
    </div>
  );
}
