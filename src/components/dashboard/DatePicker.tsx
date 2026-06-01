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

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="date-picker" className="text-sm font-medium text-muted-foreground">
        Date
      </label>
      <input
        id="date-picker"
        type="date"
        value={date}
        onChange={handleChange}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
