import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Workout } from "@/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function strainVariant(strain: number | null): "default" | "secondary" | "outline" | "destructive" {
  if (strain === null || strain < 10) return "secondary";
  if (strain < 14) return "outline";
  if (strain < 18) return "default";
  return "destructive";
}

export default function WorkoutCard({ workout }: { workout: Workout }) {
  return (
    <Card className="border-l-4 border-l-blue-500/60 bg-blue-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-blue-300">{workout.sportName}</CardTitle>
          {workout.strain !== null && (
            <Badge variant={strainVariant(workout.strain)}>
              Strain {workout.strain.toFixed(1)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatTime(workout.start)} – {formatTime(workout.end)} · {formatDuration(workout.start, workout.end)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 text-sm">
          {workout.kilocalories !== null && (
            <div>
              <p className="text-muted-foreground text-xs">Calories</p>
              <p className="font-semibold">{workout.kilocalories} kcal</p>
            </div>
          )}
          {workout.avgHeartRate !== null && (
            <div>
              <p className="text-muted-foreground text-xs">Avg HR</p>
              <p className="font-semibold">{workout.avgHeartRate} bpm</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
