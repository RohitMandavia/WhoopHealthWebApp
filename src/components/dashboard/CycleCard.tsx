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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Day Strain
        </CardTitle>
        {cycle.strain !== null && (
          <p className="text-4xl font-bold">{cycle.strain.toFixed(1)}</p>
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
