import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sleep } from "@/types";

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value ?? "—"}</p>
    </div>
  );
}

function mins(m: number | null) {
  if (m === null) return null;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function SleepCard({ sleep }: { sleep: Sleep }) {
  return (
    <Card className="border-l-4 border-l-purple-500/60 bg-purple-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-purple-400/70 uppercase tracking-widest">
          Sleep
        </CardTitle>
        {sleep.durationHours !== null && (
          <p className="text-5xl font-bold tracking-tight text-purple-400">
            {sleep.durationHours}h
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Performance" value={sleep.performancePct !== null ? `${sleep.performancePct}%` : null} />
          <Stat label="Efficiency" value={sleep.efficiencyPct !== null ? `${sleep.efficiencyPct}%` : null} />
          <Stat label="Consistency" value={sleep.consistencyPct !== null ? `${sleep.consistencyPct}%` : null} />
          <Stat label="Resp. Rate" value={sleep.respiratoryRate !== null ? `${sleep.respiratoryRate} rpm` : null} />
          <Stat label="REM" value={mins(sleep.remMins)} />
          <Stat label="Deep" value={mins(sleep.deepMins)} />
          <Stat label="Light" value={mins(sleep.lightMins)} />
          <Stat label="Awake" value={mins(sleep.awakeMins)} />
        </div>
      </CardContent>
    </Card>
  );
}
