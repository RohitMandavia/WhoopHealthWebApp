import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { google, calendar_v3 } from "googleapis";
import { getAuthedClient } from "@/lib/google";
import { getCurrentUserId } from "@/lib/auth";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface ParsedEvent {
  title: string;
  startTime: string;   // HH:MM 24h
  endTime: string;     // HH:MM 24h
  rrule: string | null; // RFC 5545 RRULE or null for one-off
  firstDate: string;   // YYYY-MM-DD
}

interface ConflictEvent {
  summary: string;
  start: string;
  end: string;
  htmlLink: string;
}

// Returns the next N dates matching a weekly RRULE (BYDAY=MO,TU,...) starting from firstDate
function nextOccurrences(firstDate: string, rrule: string | null, n: number): string[] {
  if (!rrule) return [firstDate];

  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const bydayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
  const targetDays = bydayMatch
    ? bydayMatch[1].split(",").map((d) => dayMap[d]).filter((d) => d !== undefined)
    : [];

  if (targetDays.length === 0) return [firstDate];

  const dates: string[] = [];
  const start = new Date(firstDate + "T12:00:00Z"); // noon UTC to avoid DST edge cases
  const cursor = new Date(start);

  while (dates.length < n) {
    if (targetDays.includes(cursor.getUTCDay())) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getTime() - start.getTime() > 365 * 24 * 3600 * 1000) break; // safety cap
  }

  return dates;
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  // 1. Parse natural language into structured event data
  let parsed: ParsedEvent;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Today is ${today}. Parse a calendar scheduling request into JSON with these exact keys:
- title: string (event name)
- startTime: string (HH:MM, 24-hour)
- endTime: string (HH:MM, 24-hour)
- rrule: string or null (RFC 5545 RRULE for recurring events, e.g. "RRULE:FREQ=WEEKLY;BYDAY=WE", null if one-off)
- firstDate: string (YYYY-MM-DD, the next upcoming date this event should start, on or after today)

Examples:
"dance classes 7-8:30pm every Wednesday" → { "title": "Dance Classes", "startTime": "19:00", "endTime": "20:30", "rrule": "RRULE:FREQ=WEEKLY;BYDAY=WE", "firstDate": "next Wednesday's date" }
"lunch with mom tomorrow at noon for 1 hour" → { "title": "Lunch with Mom", "startTime": "12:00", "endTime": "13:00", "rrule": null, "firstDate": "tomorrow's date" }`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: "json_object" },
    });

    parsed = JSON.parse(completion.choices[0].message.content ?? "{}") as ParsedEvent;
    if (!parsed.title || !parsed.startTime || !parsed.endTime || !parsed.firstDate) {
      throw new Error("incomplete parse");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "parse_failed", detail: msg }, { status: 422 });
  }

  // 2. Create Google Calendar event
  let createdEvent: { summary: string | null | undefined; htmlLink: string | null | undefined; id: string | null | undefined };
  try {
    const auth = await getAuthedClient(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const startDateTime = `${parsed.firstDate}T${parsed.startTime}:00`;
    const endDateTime = `${parsed.firstDate}T${parsed.endTime}:00`;

    const eventBody: calendar_v3.Schema$Event = {
      summary: parsed.title,
      start: { dateTime: startDateTime, timeZone: "America/New_York" },
      end: { dateTime: endDateTime, timeZone: "America/New_York" },
    };
    if (parsed.rrule) {
      eventBody.recurrence = [parsed.rrule];
    }

    const res = await calendar.events.insert({ calendarId: "primary", requestBody: eventBody });
    createdEvent = {
      summary: res.data.summary,
      htmlLink: res.data.htmlLink,
      id: res.data.id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "not_connected") {
      return NextResponse.json({ error: "not_connected" }, { status: 401 });
    }
    return NextResponse.json({ error: "calendar_failed", detail: msg }, { status: 500 });
  }

  // 3. Detect conflicts across next 8 occurrences
  const conflicts: ConflictEvent[] = [];
  try {
    const auth = await getAuthedClient(userId);
    const calendar = google.calendar({ version: "v3", auth });
    const occurrences = nextOccurrences(parsed.firstDate, parsed.rrule, 8);

    for (const date of occurrences) {
      const timeMin = `${date}T${parsed.startTime}:00-05:00`; // ET offset
      const timeMax = `${date}T${parsed.endTime}:00-05:00`;

      const listRes = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });

      for (const ev of listRes.data.items ?? []) {
        if (ev.id === createdEvent.id) continue; // skip the event we just created
        conflicts.push({
          summary: ev.summary ?? "(no title)",
          start: ev.start?.dateTime ?? ev.start?.date ?? "",
          end: ev.end?.dateTime ?? ev.end?.date ?? "",
          htmlLink: ev.htmlLink ?? "",
        });
      }
    }
  } catch {
    // Conflict detection is best-effort; don't fail the whole request
  }

  return NextResponse.json({
    event: {
      summary: createdEvent.summary,
      htmlLink: createdEvent.htmlLink,
      firstDate: parsed.firstDate,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      rrule: parsed.rrule,
    },
    conflicts,
  });
}
