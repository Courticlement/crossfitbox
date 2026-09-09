import { tenantPrisma } from "@/lib/prisma";
import { toDateOnly, startOfWeekMonday, addDays, isoWeekday } from "@/lib/dates";
import { buildIcsFeed } from "@/lib/calendar-feed";

// The coach's own calendar-subscription feed (see CalendarSyncCard /
// regenerateCalendarToken) — no session, no cookie, since a phone's
// Calendar app can't carry either when it re-polls this URL on its own
// schedule. The token in the path is the only credential; organizationId
// alongside it isn't secret (it's already visible in the /login box
// picker) — it's just what tells tenantPrisma which schema to query,
// mirroring the coachId+organizationId a signed session token would carry.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; token: string }> }
) {
  const { organizationId, token } = await params;
  if (!token) {
    return new Response("Not found", { status: 404 });
  }

  // Wraps the tenantPrisma() construction *and* every query below: a
  // well-formed but nonexistent organizationId (e.g. a stale or guessed
  // link) passes tenantPrisma's own format guard and only fails once a
  // query hits its schema — a plain "does not exist" from Postgres, which
  // should read as 404 to the caller just like a malformed id or an
  // unmatched token, never as an unhandled 500.
  try {
    const prisma = tenantPrisma(organizationId);

    const coach = await prisma.coach.findFirst({
      where: { calendarToken: token, archived: false },
    });
    if (!coach) {
      return new Response("Not found", { status: 404 });
    }

    // Starting at the week (not just today) keeps the rest of an
    // in-progress week visible instead of only what's still ahead today.
    // The forward edge follows the same "next week opens Friday" rule as
    // the coach's own /upload view (see UploadPage's maxWeekStart) — a
    // subscribed calendar shouldn't leak next week's schedule before the
    // admin's typically finished planning it. Once Friday opens it, a class
    // only ever gets generated a handful of weeks ahead anyway (see
    // generateWeek), so a fixed 180-day window is generous rather than an
    // artificial cutoff. Either way this week's own classes — and any
    // last-minute change to one — reach the feed the moment a calendar app
    // re-polls, since nothing here is cached (see Cache-Control below).
    const today = toDateOnly(new Date());
    const thisWeekStart = startOfWeekMonday(today);
    const windowStart = thisWeekStart;
    const nextWeekOpen = isoWeekday(today) >= 5;
    const windowEnd = nextWeekOpen ? addDays(today, 180) : addDays(thisWeekStart, 7);

    const instances = await prisma.classInstance.findMany({
      where: {
        // A substitute taking over (assignSubstitute) leaves coachId
        // pointing at whoever was originally on the hook — they're not the
        // one actually delivering it anymore, so their feed should drop it
        // in favor of the substitute's. `substituteCoachId: null` on the
        // first branch is what makes that handoff exclusive instead of
        // leaving it on both calendars.
        OR: [
          { coachId: coach.id, substituteCoachId: null },
          { substituteCoachId: coach.id },
        ],
        status: { not: "CANCELLED" },
        date: { gte: windowStart, lt: windowEnd },
      },
      include: { room: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const ics = buildIcsFeed(coach.name, instances);
    const filename = `planning-${coach.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.ics`;

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        // Every request re-reads the coach's current schedule — a stale
        // cached copy would defeat the whole point of a live feed.
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
