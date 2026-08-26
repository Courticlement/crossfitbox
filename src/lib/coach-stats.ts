import { timeToMinutes } from "@/lib/calendar-layout";
import { formatDateISO, startOfWeekMonday } from "@/lib/dates";
import { PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";

export type ClassInstanceForStats = {
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  isPrivate: boolean;
  coachId: string | null;
  substituteCoachId: string | null;
};

export type CoachStats = {
  hoursThisMonth: number;
  hoursLastMonth: number;
  // Total hours delivered divided by the number of fully-elapsed calendar
  // months with any activity — the current (still in-progress) month is
  // excluded so a month that's only just started doesn't drag this down.
  averageHoursPerMonth: number | null;
  privateClassesDone: number;
  // € owed for group classes this coach delivered in a week the admin has
  // explicitly validated (see PlanningWeek / validateWeek) — private classes
  // are never paid through this rate, and classes in a not-yet-validated
  // week don't count until the admin signs off on that week.
  amountThisMonth: number;
  amountLastMonth: number;
  // € the coach owes the box for private classes delivered this/last month
  // (see PRIVATE_CLASS_COST_EUR) — unlike amountThisMonth/LastMonth, this
  // doesn't depend on the week being validated.
  privateCostThisMonth: number;
  privateCostLastMonth: number;
};

export function classDurationHours(startTime: string, endTime: string): number {
  return (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
}

// Hours actually delivered by each coach, bucketed by calendar month, for a
// given year — same "who delivered it" rule as computeCoachStats (a DONE
// report credits its coachId, a MISSED report credits whoever substituted),
// just summed per month instead of this/last-month only. Used by the
// dashboard's yearly hours-per-coach chart.
export function computeMonthlyHoursByCoach(
  instances: Pick<
    ClassInstanceForStats,
    "date" | "startTime" | "endTime" | "status" | "coachId" | "substituteCoachId"
  >[],
  year: number
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const inst of instances) {
    if (inst.date.getUTCFullYear() !== year) continue;
    const deliveredBy =
      inst.status === "DONE"
        ? inst.coachId
        : inst.status === "MISSED"
          ? inst.substituteCoachId
          : null;
    if (!deliveredBy) continue;

    const months = result.get(deliveredBy) ?? new Array(12).fill(0);
    months[inst.date.getUTCMonth()] += classDurationHours(inst.startTime, inst.endTime);
    result.set(deliveredBy, months);
  }
  return result;
}

export function computeCoachStats(
  coachId: string,
  instances: ClassInstanceForStats[],
  // € per validated group class — the caller resolves this (coach.rate, or
  // the CrossFit-level default when unset; see groupClassRate) rather than
  // this function looking it up itself.
  rate: number,
  validatedWeekStarts: ReadonlySet<string>,
  now: Date = new Date()
): CoachStats {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  let hoursThisMonth = 0;
  let hoursLastMonth = 0;
  let privateClassesDone = 0;
  let amountThisMonth = 0;
  let amountLastMonth = 0;
  let privateThisMonth = 0;
  let privateLastMonth = 0;
  const pastMonthHours = new Map<string, number>(); // "YYYY-M" -> hours, excludes current month

  for (const inst of instances) {
    // Who actually delivered this class: a DONE report always directly
    // credits its coachId (see submitClassReports — the most recent DONE
    // report always wins), while a MISSED report credits whoever covered it
    // as a substitute, if anyone did.
    const deliveredBy =
      inst.status === "DONE"
        ? inst.coachId
        : inst.status === "MISSED"
          ? inst.substituteCoachId
          : null;

    const isAccountable = inst.coachId === coachId; // on the hook for this class
    const deliveredByThisCoach = deliveredBy === coachId;

    if (!isAccountable && !deliveredByThisCoach) continue;

    if (deliveredByThisCoach) {
      const duration = classDurationHours(inst.startTime, inst.endTime);
      if (inst.date >= currentMonthStart && inst.date < nextMonthStart) {
        hoursThisMonth += duration;
      }
      if (inst.date >= lastMonthStart && inst.date < currentMonthStart) {
        hoursLastMonth += duration;
      }
      if (inst.date < currentMonthStart) {
        const monthKey = `${inst.date.getUTCFullYear()}-${inst.date.getUTCMonth()}`;
        pastMonthHours.set(monthKey, (pastMonthHours.get(monthKey) ?? 0) + duration);
      }

      if (inst.isPrivate) {
        privateClassesDone++;
        if (inst.date >= currentMonthStart && inst.date < nextMonthStart) {
          privateThisMonth++;
        }
        if (inst.date >= lastMonthStart && inst.date < currentMonthStart) {
          privateLastMonth++;
        }
      } else {
        const weekStartStr = formatDateISO(startOfWeekMonday(inst.date));
        if (validatedWeekStarts.has(weekStartStr)) {
          if (inst.date >= currentMonthStart && inst.date < nextMonthStart) {
            amountThisMonth += rate;
          }
          if (inst.date >= lastMonthStart && inst.date < currentMonthStart) {
            amountLastMonth += rate;
          }
        }
      }
    }
  }

  const averageHoursPerMonth =
    pastMonthHours.size > 0
      ? Array.from(pastMonthHours.values()).reduce((a, b) => a + b, 0) / pastMonthHours.size
      : null;

  return {
    hoursThisMonth,
    hoursLastMonth,
    averageHoursPerMonth,
    privateClassesDone,
    amountThisMonth,
    amountLastMonth,
    privateCostThisMonth: privateThisMonth * PRIVATE_CLASS_COST_EUR,
    privateCostLastMonth: privateLastMonth * PRIVATE_CLASS_COST_EUR,
  };
}
