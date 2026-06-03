import { prisma } from "./prisma";
import type { Workout, DailyCycle, Recovery, Sleep, WhoopDaily } from "@/types";

const BASE = "https://api.prod.whoop.com/developer/v2";

async function getValidAccessToken(userId: string): Promise<string> {
  const token = await prisma.whoopToken.findUnique({ where: { userId } });
  if (!token) throw new Error("WHOOP_NOT_CONNECTED");

  if (token.expiresAt > new Date()) return token.accessToken;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
  });

  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error("WHOOP_REFRESH_FAILED");

  const refreshed = await res.json();

  await prisma.whoopToken.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });

  return refreshed.access_token;
}

async function whoopGet(path: string, params: Record<string, string>, token: string) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHOOP ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Fetch midnight UTC → noon UTC next day (36h). The extra 12h past midnight
// covers the 4am reset for any US timezone (4am ET = 8am UTC, 4am PT = 11am UTC).
// Workouts are then filtered to the correct local date after fetching.
function dateRange(date: string) {
  const d = new Date(`${date}T12:00:00.000Z`);
  const start = new Date(d.getTime() - 12 * 3600 * 1000).toISOString(); // midnight UTC
  const end   = new Date(d.getTime() + 24 * 3600 * 1000).toISOString(); // noon UTC next day
  return { start, end };
}

const RESET_HOUR = 4; // activities before 4am count as the previous day

function localDate(isoTimestamp: string, tz: string): string {
  try {
    const shifted = new Date(new Date(isoTimestamp).getTime() - RESET_HOUR * 3600 * 1000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(shifted);
  } catch {
    return isoTimestamp.slice(0, 10);
  }
}

export async function fetchWhoopDaily(date: string, userId: string, tz = "UTC"): Promise<WhoopDaily> {
  const accessToken = await getValidAccessToken(userId);
  const range = dateRange(date);

  const [cycleData, recoveryData, sleepData, workoutData] = await Promise.allSettled([
    whoopGet("/cycle", { ...range, limit: "5" }, accessToken),
    whoopGet("/recovery", { ...range, limit: "5" }, accessToken),
    whoopGet("/activity/sleep", { ...range, limit: "5" }, accessToken),
    whoopGet("/activity/workout", { ...range, limit: "25" }, accessToken),
  ]);

  // --- Cycle ---
  let cycle: DailyCycle | null = null;
  if (cycleData.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (cycleData.value.records ?? [])[0] as any;
    if (r) {
      cycle = {
        strain: r.score?.strain ?? null,
        kilocalories: r.score?.kilojoule != null
          ? Math.round(r.score.kilojoule * 0.239006)
          : null,
        avgHeartRate: r.score?.average_heart_rate ?? null,
        maxHeartRate: r.score?.max_heart_rate ?? null,
      };
    }
  }

  // --- Recovery ---
  let recovery: Recovery | null = null;
  if (recoveryData.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (recoveryData.value.records ?? [])[0] as any;
    if (r) {
      recovery = {
        score: r.score?.recovery_score ?? null,
        restingHeartRate: r.score?.resting_heart_rate ?? null,
        hrv: r.score?.hrv_rmssd_milli != null
          ? Math.round(r.score.hrv_rmssd_milli)
          : null,
        spo2: r.score?.spo2_percentage ?? null,
        skinTempCelsius: r.score?.skin_temp_celsius ?? null,
      };
    }
  }

  // --- Sleep ---
  let sleep: Sleep | null = null;
  if (sleepData.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (sleepData.value.records ?? [])[0] as any;
    if (r) {
      const stages = r.score?.stage_summary ?? {};
      const totalMs = stages.total_in_bed_time_milli ?? 0;
      sleep = {
        durationHours: totalMs ? Math.round((totalMs / 3600000) * 10) / 10 : null,
        performancePct: r.score?.sleep_performance_percentage ?? null,
        efficiencyPct: r.score?.sleep_efficiency_percentage != null
          ? Math.round(r.score.sleep_efficiency_percentage)
          : null,
        consistencyPct: r.score?.sleep_consistency_percentage ?? null,
        respiratoryRate: r.score?.respiratory_rate != null
          ? Math.round(r.score.respiratory_rate * 10) / 10
          : null,
        remMins: stages.total_rem_sleep_time_milli != null
          ? Math.round(stages.total_rem_sleep_time_milli / 60000)
          : null,
        deepMins: stages.total_slow_wave_sleep_time_milli != null
          ? Math.round(stages.total_slow_wave_sleep_time_milli / 60000)
          : null,
        lightMins: stages.total_light_sleep_time_milli != null
          ? Math.round(stages.total_light_sleep_time_milli / 60000)
          : null,
        awakeMins: stages.total_awake_time_milli != null
          ? Math.round(stages.total_awake_time_milli / 60000)
          : null,
      };
    }
  }

  // --- Workouts ---
  // Filter to only workouts that started on the requested date in the user's local timezone.
  // The fetch window is wider than one day (to catch cycles), so without this filter
  // late-evening workouts from the previous day would bleed into today's view.
  let workouts: Workout[] = [];
  if (workoutData.status === "fulfilled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workouts = (workoutData.value.records ?? [])
      .filter((w: any) => localDate(w.start, tz) === date)
      .map((w: any) => ({
        sportName: w.sport_name ?? "Workout",
        start: w.start,
        end: w.end,
        kilocalories: w.score?.kilojoules != null
          ? Math.round(w.score.kilojoules * 0.239006)
          : null,
        strain: w.score?.strain ?? null,
        avgHeartRate: w.score?.average_heart_rate ?? null,
      }));
  }

  return { cycle, recovery, sleep, workouts };
}

export async function fetchSleepHistory(
  userId: string,
  tz: string,
  days = 7
): Promise<{ date: string; sleepHours: number | null }[]> {
  // Get token ONCE — avoids parallel refresh races when called alongside fetchWhoopDaily
  const accessToken = await getValidAccessToken(userId);

  // Build the list of target dates (4am reset)
  const now = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString("en-CA"));
  }

  // One API call covering the full window
  const windowStart = new Date(dates[0] + "T00:00:00.000Z").toISOString();
  const windowEnd   = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();

  const data = await whoopGet(
    "/activity/sleep",
    { start: windowStart, end: windowEnd, limit: String(days + 3) },
    accessToken
  );

  // Map each record to its local date using the wake-up time (end) with 4h reset
  const recordsByDate = new Map<string, number>();
  for (const r of (data.records ?? []) as Record<string, unknown>[]) {
    if (!r.end) continue;
    const date = localDate(r.end as string, tz);
    if (!dates.includes(date)) continue;
    const stages = (r.score as Record<string, unknown> | null)?.stage_summary as Record<string, number> | null ?? {};
    const totalMs = stages.total_in_bed_time_milli ?? 0;
    if (totalMs > 0) {
      recordsByDate.set(date, Math.round((totalMs / 3600000) * 10) / 10);
    }
  }

  return dates.map((date) => ({ date, sleepHours: recordsByDate.get(date) ?? null }));
}
