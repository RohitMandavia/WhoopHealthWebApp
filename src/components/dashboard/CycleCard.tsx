import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyCycle } from "@/types";

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value ?? "—"}</p>
    </div>
  );
}

export default function CycleCard({ cycle }: { cycle: DailyCycle }) {
  return (
    <Card className="border-l-4 border-l-orange-500/60 bg-orange-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-orange-400/70 uppercase tracking-widest">
          Day Strain
        </CardTitle>
        {cycle.strain !== null && (
          <p className="text-5xl font-bold tracking-tight text-orange-400">
            {cycle.strain.toFixed(1)}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Calories Burned" value={cycle.kilocalories !== null ? `${cycle.kilocalories} kcal` : null} />
          <Stat label="Avg HR" value={cycle.avgHeartRate !== null ? `${cycle.avgHeartRate} bpm` : null} />
          <Stat label="Max HR" value={cycle.maxHeartRate !== null ? `${cycle.maxHeartRate} bpm` : null} />
        </div>
      </CardContent>
    </Card>
  );
}
