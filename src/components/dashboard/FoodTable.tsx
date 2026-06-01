"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import MacroSummaryRow from "./MacroSummaryRow";
import type { FoodLog, FoodItem } from "@/types";

interface FlatItem extends FoodItem {
  logId: string;
  itemIndex: number;
}

interface FoodTableProps {
  logs: FoodLog[];
  onDeleteLog?: (id: string) => void;
  onUpdateLog?: (id: string, items: FoodItem[]) => void;
}

export default function FoodTable({ logs, onDeleteLog, onUpdateLog }: FoodTableProps) {
  const editable = !!(onDeleteLog && onUpdateLog);
  const [editingKey, setEditingKey] = useState<string | null>(null); // "logId-itemIndex"
  const [editValues, setEditValues] = useState<Partial<FoodItem>>({});

  const allItems: FlatItem[] = logs.flatMap((log) =>
    log.items.map((item, i) => ({ ...item, logId: log.id, itemIndex: i }))
  );

  if (allItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No food logged yet. Enter what you ate above.
      </p>
    );
  }

  function startEdit(item: FlatItem) {
    setEditingKey(`${item.logId}-${item.itemIndex}`);
    setEditValues({
      name: item.name,
      quantity: item.quantity,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    });
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValues({});
  }

  function saveEdit(item: FlatItem) {
    const log = logs.find((l) => l.id === item.logId);
    if (!log) return;

    const updatedItems = log.items.map((orig, i) =>
      i === item.itemIndex
        ? {
            ...orig,
            name: String(editValues.name ?? orig.name),
            quantity: String(editValues.quantity ?? orig.quantity),
            calories: Number(editValues.calories ?? orig.calories),
            protein: Number(editValues.protein ?? orig.protein),
            carbs: Number(editValues.carbs ?? orig.carbs),
            fat: Number(editValues.fat ?? orig.fat),
          }
        : orig
    );

    fetch(`/api/food/log/${item.logId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updatedItems }),
    }).then(() => {
      onUpdateLog!(item.logId, updatedItems);
      cancelEdit();
    });
  }

  function deleteItem(item: FlatItem) {
    const log = logs.find((l) => l.id === item.logId);
    if (!log) return;

    const remaining = log.items.filter((_, i) => i !== item.itemIndex);

    if (remaining.length === 0) {
      fetch(`/api/food/log/${item.logId}`, { method: "DELETE" })
        .then(() => onDeleteLog!(item.logId));
    } else {
      fetch(`/api/food/log/${item.logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: remaining }),
      }).then(() => onUpdateLog!(item.logId, remaining));
    }
  }

  function numField(field: keyof FoodItem) {
    return (
      <input
        type="number"
        step="0.1"
        value={editValues[field] as number ?? 0}
        onChange={(e) => setEditValues((v) => ({ ...v, [field]: parseFloat(e.target.value) || 0 }))}
        className="w-16 rounded border border-input bg-background px-1 py-0.5 text-right text-sm"
      />
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead className="text-right">Calories</TableHead>
            <TableHead className="text-right">Protein (g)</TableHead>
            <TableHead className="text-right">Carbs (g)</TableHead>
            <TableHead className="text-right">Fat (g)</TableHead>
            {editable && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allItems.map((item) => {
            const key = `${item.logId}-${item.itemIndex}`;
            const isEditing = editingKey === key;

            return (
              <TableRow key={key} className={isEditing ? "bg-muted/50" : undefined}>
                {isEditing ? (
                  <>
                    <TableCell>
                      <input
                        value={editValues.name ?? ""}
                        onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                        className="w-full rounded border border-input bg-background px-1 py-0.5 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        value={editValues.quantity ?? ""}
                        onChange={(e) => setEditValues((v) => ({ ...v, quantity: e.target.value }))}
                        className="w-full rounded border border-input bg-background px-1 py-0.5 text-sm"
                      />
                    </TableCell>
                    <TableCell className="text-right">{numField("calories")}</TableCell>
                    <TableCell className="text-right">{numField("protein")}</TableCell>
                    <TableCell className="text-right">{numField("carbs")}</TableCell>
                    <TableCell className="text-right">{numField("fat")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => saveEdit(item)}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={cancelEdit}>✕</Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.calories}</TableCell>
                    <TableCell className="text-right">{item.protein.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{item.carbs.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{item.fat.toFixed(1)}</TableCell>
                    {editable && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => startEdit(item)}>Edit</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => deleteItem(item)}>✕</Button>
                        </div>
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
        <tfoot>
          <MacroSummaryRow items={allItems} />
        </tfoot>
      </Table>
    </div>
  );
}
