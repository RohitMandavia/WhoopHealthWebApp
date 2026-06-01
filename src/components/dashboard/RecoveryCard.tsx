import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recovery } from "@/types";

function recoveryColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 67) return "text-green-600";
  if (score >= 34) return "text-yellow-500";
  return "text-red-500";
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value ?? "—"}</p>
    </div>
  );
}

export default function RecoveryCard({ recovery }: { recovery: Recovery }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recovery
        </CardTitle>
        {recovery.score !== null && (
          <p className={`text-4xl font-bold ${recoveryColor(recovery.score)}`}>
            {recovery.score}%
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Resting HR" value={recovery.restingHeartRate !== null ? `${recovery.restingHeartRate} bpm` : null} />
          <Stat label="HRV" value={recovery.hrv !== null ? `${recovery.hrv} ms` : null} />
          <Stat label="SpO₂" value={recovery.spo2 !== null ? `${recovery.spo2.toFixed(1)}%` : null} />
          <Stat label="Skin Temp" value={recovery.skinTempCelsius !== null ? `${recovery.skinTempCelsius.toFixed(1)} °C` : null} />
        </div>
      </CardContent>
    </Card>
  );
}
