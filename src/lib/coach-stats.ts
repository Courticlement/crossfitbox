import { timeToMinutes } from "@/lib/calendar-layout";

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
  // Share of assigned classes the coach personally delivered (DONE, and not
  // covered by a substitute) out of all assigned classes with a reported
  // outcome (DONE + MISSED + CANCELLED). A class handed off to a substitute
  // counts against the planned coach's rate even if it ended up DONE, since
  // they didn't show up for it. PLANNED classes are excluded — not reported yet.
  reliabilityRate: number | null;
  privateClassesDone: number;
};

function classDurationHours(startTime: string, endTime: string): number {
  return (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
}

const REPORTED_STATUSES = new Set(["DONE", "MISSED", "CANCELLED"]);

export function computeCoachStats(
  coachId: string,
  instances: ClassInstanceForStats[],
  now: Date = new Date()
): CoachStats {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  let hoursThisMonth = 0;
  let hoursLastMonth = 0;
  let doneCount = 0;
  let reportedCount = 0;
  let privateClassesDone = 0;

  for (const inst of instances) {
    // Who actually delivered this class: a DONE report always directly
    // credits its coachId (see submitClassReport — the most recent DONE
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

    // Reliability is scored against whoever was accountable for the class,
    // not whoever ended up covering it — a substitute picking up someone
    // else's missed class doesn't get an extra "expected" class on their
    // own record, good or bad.
    if (isAccountable && REPORTED_STATUSES.has(inst.status)) {
      reportedCount++;
      if (deliveredByThisCoach) doneCount++;
    }

    if (deliveredByThisCoach) {
      const duration = classDurationHours(inst.startTime, inst.endTime);
      if (inst.date >= currentMonthStart && inst.date < nextMonthStart) {
        hoursThisMonth += duration;
      }
      if (inst.date >= lastMonthStart && inst.date < currentMonthStart) {
        hoursLastMonth += duration;
      }
      if (inst.isPrivate) privateClassesDone++;
    }
  }

  return {
    hoursThisMonth,
    hoursLastMonth,
    reliabilityRate: reportedCount > 0 ? doneCount / reportedCount : null,
    privateClassesDone,
  };
}
