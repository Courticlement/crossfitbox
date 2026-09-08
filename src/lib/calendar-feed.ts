// Builds the .ics body served by /calendar/[organizationId]/[token] (see
// lib/actions/calendar-sync.ts for how a coach turns this on). RFC 5545
// with just enough of it — one VCALENDAR, plain VEVENTs, no line folding
// (every field here is short enough that it never matters in practice).

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// classInstance.date is a floating UTC-midnight "calendar day" (see
// lib/dates.ts) and startTime/endTime are plain "HH:mm" wall-clock strings
// for the box's own timezone — reading the date's UTC getters and pasting
// the time string straight in avoids any DST arithmetic entirely, which is
// exactly right since neither value carries a timezone of its own; the
// TZID parameter on DTSTART/DTEND is what actually pins them to
// Europe/Paris for the reader.
function icsLocalDateTime(date: Date, time: string): string {
  const [hh, mm] = time.split(":");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${hh}${mm}00`;
}

// DTSTAMP is "when this record was generated," always UTC per RFC 5545 —
// unrelated to the event's own local start/end above.
function icsUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export type IcsClassInstance = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
  isPrivate: boolean;
  room: { name: string };
};

export function buildIcsFeed(coachName: string, instances: IcsClassInstance[]): string {
  const now = icsUtcStamp(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Crossfit Box//Coach Planning//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`Cours — ${coachName}`)}`,
    // Both are hints, not guarantees — clients that honor either poll on
    // roughly this cadence instead of once a day; the rest just fall back
    // to their own default.
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const inst of instances) {
    lines.push(
      "BEGIN:VEVENT",
      // Stable across regenerations of the *link* — it's keyed to the
      // class, not the token — so re-subscribing (or a calendar app's
      // routine re-fetch) updates existing entries instead of duplicating
      // them.
      `UID:${inst.id}@crossfitbox`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=Europe/Paris:${icsLocalDateTime(inst.date, inst.startTime)}`,
      `DTEND;TZID=Europe/Paris:${icsLocalDateTime(inst.date, inst.endTime)}`,
      `SUMMARY:${icsEscape(inst.isPrivate ? `${inst.label} (privé)` : inst.label)}`,
      `LOCATION:${icsEscape(inst.room.name)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
