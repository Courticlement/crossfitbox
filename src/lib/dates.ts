// All "date-only" values in this app are represented as UTC-midnight Date
// objects ("floating" dates with no time-of-day meaning). Every function here
// reads/writes exclusively via the UTC getters/setters and display helpers
// pin timeZone: "UTC" — mixing in local getters (e.g. toISOString() on a
// locally-constructed date, or new Date(str) parsing) reintroduces off-by-one
// day bugs for any timezone that isn't UTC+0.

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// dayOfWeek: 1 = Monday ... 7 = Sunday
export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek - 1] ?? "Unknown";
}

// Converts "now" (or any instant) into a floating UTC-midnight date
// representing the viewer's local calendar day. This is the one place local
// getters are used, since "what day is it right now" is inherently local.
export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// Parses a "YYYY-MM-DD" string (e.g. from a <input type="date"> or a URL
// query param) into a floating UTC-midnight date. No timezone ambiguity since
// there's no time component to interpret.
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 1..7, Mon..Sun
  d.setUTCDate(d.getUTCDate() - (isoDay - 1));
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
