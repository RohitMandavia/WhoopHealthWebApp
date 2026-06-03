"use client";

import { useRouter } from "next/navigation";

interface DatePickerProps {
  date: string; // "YYYY-MM-DD"
}

export default function DatePicker({ date }: DatePickerProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    router.push(`/?date=${e.target.value}`);
  }

  const today = new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleDateString("en-CA");
  const isToday = date === today;

  return (
    <div className="flex items-center gap-2">
      {!isToday && (
        <button
          onClick={() => router.push("/")}
          className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Today
        </button>
      )}
      <label htmlFor="date-picker" className="text-sm font-medium text-muted-foreground">
        Date
      </label>
      <input
        id="date-picker"
        type="date"
        value={date}
        onChange={handleChange}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60"
      />
    </div>
  );
}
