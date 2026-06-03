import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DatePicker from "@/components/dashboard/DatePicker";
import WhoopSection from "@/components/dashboard/WhoopSection";
import FoodSection from "@/components/dashboard/FoodSection";
import UserPicker from "@/components/dashboard/UserPicker";
import BodyMetrics from "@/components/dashboard/BodyMetrics";
import PRSection from "@/components/dashboard/PRSection";

interface PageProps {
  searchParams: Promise<{ date?: string; view?: string; connected?: string; error?: string; calendar?: string }>;
}

function todayString() {
  const shifted = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(shifted);
}

function formatDisplayDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function Home({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const loggedInUserId = cookieStore.get("userId")?.value;

  if (!loggedInUserId) redirect("/login");

  // Redirect new users to setup if they haven't entered body metrics + goal yet
  const stats = await prisma.userStats.findUnique({ where: { userId: loggedInUserId } });
  if (!stats?.weightLbs || !stats?.bodyFatPct || !stats?.mode) redirect("/setup");

  const params = await searchParams;
  const date = params.date ?? todayString();
  const viewUserId = params.view ?? loggedInUserId;
  const isOwner = viewUserId === loggedInUserId;
  const connectedWhoop = params.connected === "whoop";
  const connectedCalendar = params.calendar === "connected";
  const hasError = !!params.error;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 bg-gradient-to-r from-indigo-500/10 via-transparent to-purple-500/10">
        <div className="mx-auto max-w-6xl space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Health Tracker</h1>
            <DatePicker date={date} />
          </div>
          <UserPicker loggedInUserId={loggedInUserId} currentViewId={viewUserId} date={date} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-4">
        {connectedWhoop && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
            Whoop connected successfully.
          </div>
        )}
        {connectedCalendar && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
            Google Calendar connected successfully.
          </div>
        )}
        {hasError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-800">
            Error: <code className="font-mono">{params.error}</code>
          </div>
        )}

        <p className="text-muted-foreground text-sm">
          {formatDisplayDate(date)}
          {!isOwner && (
            <span className="ml-2 text-xs bg-muted rounded-full px-2 py-0.5">
              viewing {/* server doesn't have the name here; UserPicker shows it */}
            </span>
          )}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-8">
            {/* Body metrics — same width as activity column */}
            <BodyMetrics date={date} userId={viewUserId} isOwner={isOwner} />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Activity</h2>
                {isOwner && (
                  <a href="/api/whoop/auth" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                    Reconnect Whoop
                  </a>
                )}
              </div>
              <WhoopSection date={date} userId={viewUserId} isOwner={isOwner} />
            </div>
          </section>

          <section className="space-y-8">
            <FoodSection date={date} userId={viewUserId} isOwner={isOwner} />
            <PRSection userId={viewUserId} isOwner={isOwner} />
          </section>
        </div>
      </main>
    </div>
  );
}
