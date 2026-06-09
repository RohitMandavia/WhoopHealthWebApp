import type { FoodItem } from "@/types";

interface MacroSummaryRowProps {
  items: FoodItem[];
}

export default function MacroSummaryRow({ items }: MacroSummaryRowProps) {
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
      fiber: acc.fiber + (item.fiber ?? 0),
      sugar: acc.sugar + (item.sugar ?? 0),
      addedSugar: acc.addedSugar + (item.addedSugar ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, addedSugar: 0 }
  );

  return (
    <tr className="bg-muted font-semibold text-sm border-t-2 border-border">
      <td className="px-4 py-3" colSpan={2}>
        Total
      </td>
      <td className="px-4 py-3 text-right">{Math.round(totals.calories)}</td>
      <td className="px-4 py-3 text-right">{totals.protein.toFixed(1)}</td>
      <td className="px-4 py-3 text-right">{totals.carbs.toFixed(1)}</td>
      <td className="px-4 py-3 text-right">{totals.fat.toFixed(1)}</td>
      <td className="px-4 py-3 text-right">{totals.fiber.toFixed(1)}</td>
      <td className="px-4 py-3 text-right">{totals.sugar.toFixed(1)}</td>
      <td className="px-4 py-3 text-right">{totals.addedSugar.toFixed(1)}</td>
    </tr>
  );
}
