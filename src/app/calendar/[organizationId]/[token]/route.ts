import { tenantPrisma } from "@/lib/prisma";
import { toDateOnly, startOfWeekMonday, addDays } from "@/lib/dates";
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

  let prisma: ReturnType<typeof tenantPrisma>;
  try {
    prisma = tenantPrisma(organizationId);
  } catch {
    // A malformed organizationId (not this app's own generated shape) —
    // tenantPrisma's own guard throws rather than ever interpolating it
    // into a schema name.
    return new Response("Not found", { status: 404 });
  }

  const coach = await prisma.coach.findFirst({
    where: { calendarToken: token, archived: false },
  });
  if (!coach) {
    return new Response("Not found", { status: 404 });
  }

  // From this week onward — a class only ever gets generated a handful of
  // weeks ahead (see generateWeek), so a fixed forward window is generous
  // rather than an artificial cutoff. Starting at the week (not just today)
  // keeps the rest of an in-progress week visible instead of only what's
  // still ahead today.
  const today = toDateOnly(new Date());
  const windowStart = startOfWeekMonday(today);
  const windowEnd = addDays(today, 180);

  const instances = await prisma.classInstance.findMany({
    where: {
      coachId: coach.id,
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
}
