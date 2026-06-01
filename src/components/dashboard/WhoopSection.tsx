"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import WorkoutCard from "./WorkoutCard";
import RecoveryCard from "./RecoveryCard";
import SleepCard from "./SleepCard";
import CycleCard from "./CycleCard";
import type { WhoopDaily } from "@/types";

interface WhoopSectionProps {
  date: string;
  userId: string;
  isOwner: boolean;
}

export default function WhoopSection({ date, userId, isOwner }: WhoopSectionProps) {
  const [data, setData] = useState<WhoopDaily | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not_connected" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
    setData(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/whoop/daily?date=${date}&userId=${userId}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error === "not_connected") {
          setStatus("not_connected");
        } else if (d.error) {
          setStatus("error");
        } else {
          setData(d);
          setStatus("ready");
        }
      })
      .catch(() => setStatus("error"));
  }, [date, userId]);

  if (status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (status === "not_connected") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          {isOwner ? "Connect your Whoop to see your stats." : "This person hasn't connected Whoop yet."}
        </p>
        {isOwner && (
          <a
            href="/api/whoop/auth"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Connect Whoop
          </a>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <p className="text-sm text-destructive">Failed to load Whoop data. Please try again.</p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      {data.recovery && <RecoveryCard recovery={data.recovery} />}
      {data.cycle && <CycleCard cycle={data.cycle} />}
      {data.sleep && <SleepCard sleep={data.sleep} />}

      {data.workouts.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            Workouts
          </p>
          {data.workouts.map((w, i) => (
            <WorkoutCard key={i} workout={w} />
          ))}
        </div>
      )}

      {!data.recovery && !data.cycle && !data.sleep && data.workouts.length === 0 && (
        <p className="text-sm text-muted-foreground">No data recorded for this day.</p>
      )}
    </div>
  );
}
