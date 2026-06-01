import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Workout } from "@/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string) {
  const mins = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000
  );
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function strainColor(strain: number | null) {
  if (strain === null) return "secondary";
  if (strain < 10) return "secondary";
  if (strain < 14) return "outline";
  if (strain < 18) return "default";
  return "destructive";
}

interface WorkoutCardProps {
  workout: Workout;
}

export default function WorkoutCard({ workout }: WorkoutCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{workout.sportName}</CardTitle>
          {workout.strain !== null && (
            <Badge variant={strainColor(workout.strain) as "default" | "secondary" | "outline" | "destructive"}>
              Strain {workout.strain.toFixed(1)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatTime(workout.start)} – {formatTime(workout.end)} ·{" "}
          {formatDuration(workout.start, workout.end)}
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
