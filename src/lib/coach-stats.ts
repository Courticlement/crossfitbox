import { timeToMinutes } from "@/lib/calendar-layout";
import { privateClassCost } from "@/lib/coach-levels";

export type ClassInstanceForStats = {
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  isPrivate: boolean;
  // Only meaningful when isPrivate — see ClassInstance.athleteIsMember.
  // Drives which private-class rate applies (see privateClassCost).
  athleteIsMember: boolean | null;
  coachId: string | null;
  substituteCoachId: string | null;
  // € this class was paid at, snapshotted when it was marked Done — the
  // status a class only ever reaches via "Valider le planning" (see
  // validateWeek in actions/planning.ts) — null for a class marked Done
  // before this field existed, or one that's never been Done.
  paidRate: number | null;
};

export type CoachStats = {
  hoursThisMonth: number;
  hoursLastMonth: number;
  // Total hours delivered divided by the number of fully-elapsed calendar
  // months with any activity — the current (still in-progress) month is
  // excluded so a month that's only just started doesn't drag this down.
  averageHoursPerMonth: number | null;
  privateClassesDone: number;
  // € owed for group classes this coach delivered — one payment per class
  // marked Done (see validateWeek in actions/planning.ts), at the coach's
  // rate. Private classes are never paid through this rate.
  amountThisMonth: number;
  amountLastMonth: number;
  // € the coach owes the box for private classes delivered this/last month
  // (see privateClassCost — the rate depends on each class's
  // athleteIsMember) — unlike amountThisMonth/LastMonth, this doesn't
  // depend on classes being marked Done.
  privateCostThisMonth: number;
  privateCostLastMonth: number;
  // € the coach currently owes the box for private classes, running since
  // Coach.privateBalancePaidAt (or all-time if never paid) rather than
  // reset every month like privateCostThisMonth — this is what the "Marquer
  // payé" button on the Coaches page settles to zero.
  privateBalance: number;
  // The slice of privateBalance specifically owed for private classes
  // delivered last calendar month — drives the Paiements page's "still owes
  // for last month" alert. A coach can owe money without this being > 0 (a
  // debt from two+ months ago that's just never been settled), and this
  // stays > 0 even after this month starts, until actually paid.
  privateBalanceLastMonth: number;
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
  // Fallback € per group class delivered — the caller resolves this
  // (coach.rate, or the CrossFit-level default when unset; see
  // groupClassRate) rather than this function looking it up itself. Used
  // whenever a class has no paidRate snapshot of its own, and for a MISSED
  // class credited to a substitute (which was never itself validated, so
  // never gets a snapshot).
  rate: number,
  // Only private classes delivered after this date count toward
  // privateBalance — null (never paid) counts the whole history.
  privateBalancePaidAt: Date | null,
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
  let privateCostThisMonth = 0;
  let privateCostLastMonth = 0;
  let privateBalance = 0;
  let privateBalanceLastMonth = 0;
  const pastMonthHours = new Map<string, number>(); // "YYYY-M" -> hours, excludes current month

  for (const inst of instances) {
    // Who actually delivered this class: DONE always directly credits its
    // coachId (the only way there — "Valider le planning", see validateWeek
    // in actions/planning.ts), while MISSED credits whoever covered it as a
    // substitute, if anyone did.
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
        const cost = privateClassCost(inst.athleteIsMember);
        if (inst.date >= currentMonthStart && inst.date < nextMonthStart) {
          privateCostThisMonth += cost;
        }
        if (inst.date >= lastMonthStart && inst.date < currentMonthStart) {
          privateCostLastMonth += cost;
        }
        const unpaid = privateBalancePaidAt === null || inst.date > privateBalancePaidAt;
        if (unpaid) {
          privateBalance += cost;
          if (inst.date >= lastMonthStart && inst.date < currentMonthStart) {
            privateBalanceLastMonth += cost;
          }
        }
      } else if (inst.status === "DONE" || inst.status === "MISSED") {
        // The snapshot taken when this class was validated (see
        // ClassInstanceForStats.paidRate) wins over the coach's current
        // rate — only a class with no snapshot (or a MISSED class credited
        // to a substitute, which was never itself validated) falls back to
        // the live rate passed in. One flat payment per class, not scaled
        // by duration.
        const amount = inst.status === "DONE" ? (inst.paidRate ?? rate) : rate;
        if (inst.date >= currentMonthStart && inst.date < nextMonthStart) {
          amountThisMonth += amount;
        }
        if (inst.date >= lastMonthStart && inst.date < currentMonthStart) {
          amountLastMonth += amount;
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
    privateCostThisMonth,
    privateCostLastMonth,
    privateBalance,
    privateBalanceLastMonth,
  };
}
