import { prisma } from "@/lib/prisma";
import { startOfWeekMonday, addDays, toDateOnly } from "@/lib/dates";

export type PrevWeekAlert = {
  show: boolean;
  prevWeekStart: Date;
  // Still-PLANNED group classes with nobody's report to show for them — the
  // clearest signal that coaches haven't uploaded their classes yet.
  unreported: number;
};

// Always the most recently completed calendar week, regardless of which
// week any given admin page happens to be viewing — this is a standing
// reminder, not tied to navigation. `show` is false when that week was
// never planned at all (e.g. the box was closed) — nothing to validate,
// so no need to nag.
export async function getPrevWeekAlert(): Promise<PrevWeekAlert> {
  const thisWeekStart = startOfWeekMonday(toDateOnly(new Date()));
  const prevWeekStart = addDays(thisWeekStart, -7);

  const [planningWeek, instances] = await Promise.all([
    prisma.planningWeek.findUnique({ where: { weekStart: prevWeekStart } }),
    prisma.classInstance.findMany({
      where: {
        date: { gte: prevWeekStart, lt: thisWeekStart },
        status: { not: "CANCELLED" },
      },
      select: { status: true, isPrivate: true },
    }),
  ]);

  const unreported = instances.filter(
    (i) => i.status === "PLANNED" && !i.isPrivate
  ).length;

  return {
    show: planningWeek === null && instances.length > 0,
    prevWeekStart,
    unreported,
  };
}

export type CoachPrevWeekAlert = {
  show: boolean;
  prevWeekStart: Date;
  // This coach's own group classes from last week that are still sitting
  // unreported — the thing they personally need to go fix.
  unreportedMine: number;
};

// Coach-facing counterpart to getPrevWeekAlert: only fires while there's
// still something this specific coach can do about it — the admin hasn't
// validated (and thus locked) last week yet, and this coach still has
// classes assigned to them with no Done/Missed report against their name.
export async function getCoachPrevWeekAlert(coachId: string): Promise<CoachPrevWeekAlert> {
  const thisWeekStart = startOfWeekMonday(toDateOnly(new Date()));
  const prevWeekStart = addDays(thisWeekStart, -7);

  const [planningWeek, unreportedMine] = await Promise.all([
    prisma.planningWeek.findUnique({ where: { weekStart: prevWeekStart } }),
    prisma.classInstance.count({
      where: {
        date: { gte: prevWeekStart, lt: thisWeekStart },
        coachId,
        isPrivate: false,
        status: "PLANNED",
      },
    }),
  ]);

  return {
    show: planningWeek === null && unreportedMine > 0,
    prevWeekStart,
    unreportedMine,
  };
}
