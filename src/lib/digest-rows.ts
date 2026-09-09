import { tenantPrisma } from "@/lib/prisma";
import { addDays, addMonths, formatDayLabel, formatMonthLabel, isoWeekday } from "@/lib/dates";
import { classDurationHours } from "@/lib/coach-stats";
import { groupClassRate } from "@/lib/coach-levels";

export type DigestRow = {
  name: string;
  totalHours: number;
  heuresFixes: number;
  reviewCount: number;
  privateDone: number;
  netAmount: number;
};

// Mirrors the Coach/Heure total/Heures fixes/Review/Privés/Net € table on
// the dashboard (see week-dashboard.tsx and month-dashboard.tsx) — same
// columns, same numbers, whichever period the rows were computed over.
// Shared by the weekly and monthly PDF export routes.
export async function weeklyDigestRows(
  organizationId: string,
  weekStart: Date
): Promise<{ rows: DigestRow[]; periodLabel: string }> {
  const tenant = tenantPrisma(organizationId);
  const weekEnd = addDays(weekStart, 7);

  const [coaches, instances, weekReviews] = await Promise.all([
    tenant.coach.findMany({ orderBy: { name: "asc" } }),
    tenant.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd }, coachId: { not: null } },
    }),
    tenant.classReview.findMany({
      where: { classInstance: { date: { gte: weekStart, lt: weekEnd } } },
      select: { id: true, classInstance: { select: { coachId: true } } },
    }),
  ]);

  const rows: DigestRow[] = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    // Same "all non-cancelled group classes" basis as the dashboard's hours
    // columns — includes still-PLANNED classes, not just delivered ones,
    // but excludes private classes and team events.
    const activeCoachInstances = coachInstances.filter((i) => i.status !== "CANCELLED");
    const groupCoachInstances = activeCoachInstances.filter(
      (i) => !i.isPrivate && !i.isTeamEvent
    );
    const totalHours = groupCoachInstances.reduce(
      (sum, i) => sum + classDurationHours(i.startTime, i.endTime),
      0
    );
    const heuresFixes = groupCoachInstances
      .filter((i) => isoWeekday(i.date) <= 5)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    // Net € is paid per class marked Done — the status a class only ever
    // reaches via "Valider le planning" — at the rate snapshotted on it
    // (paidRate), same as week-dashboard.tsx. Group-class pay only —
    // private classes don't factor into it.
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = weekReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    const fallbackRate = coach.rate ?? groupClassRate(coach.level);
    const netAmount = coachInstances
      .filter((i) => i.status === "DONE" && !i.isPrivate)
      .reduce((sum, i) => sum + (i.paidRate ?? fallbackRate), 0);
    return { name: coach.name, totalHours, heuresFixes, reviewCount, privateDone, netAmount };
  });

  const periodLabel = `${formatDayLabel(weekStart)} au ${formatDayLabel(addDays(weekStart, 6))}`;
  return { rows, periodLabel };
}

export async function monthlyDigestRows(
  organizationId: string,
  monthStart: Date
): Promise<{ rows: DigestRow[]; periodLabel: string }> {
  const tenant = tenantPrisma(organizationId);
  const monthEnd = addMonths(monthStart, 1);

  const [coaches, instances, monthReviews] = await Promise.all([
    tenant.coach.findMany({ orderBy: { name: "asc" } }),
    tenant.classInstance.findMany({
      where: { date: { gte: monthStart, lt: monthEnd }, coachId: { not: null } },
    }),
    tenant.classReview.findMany({
      where: { classInstance: { date: { gte: monthStart, lt: monthEnd } } },
      select: { id: true, classInstance: { select: { coachId: true } } },
    }),
  ]);

  const rows: DigestRow[] = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    const activeCoachInstances = coachInstances.filter((i) => i.status !== "CANCELLED");
    const groupCoachInstances = activeCoachInstances.filter(
      (i) => !i.isPrivate && !i.isTeamEvent
    );
    const totalHours = groupCoachInstances.reduce(
      (sum, i) => sum + classDurationHours(i.startTime, i.endTime),
      0
    );
    const heuresFixes = groupCoachInstances
      .filter((i) => isoWeekday(i.date) <= 5)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = monthReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    const fallbackRate = coach.rate ?? groupClassRate(coach.level);
    const netAmount = coachInstances
      .filter((i) => i.status === "DONE" && !i.isPrivate)
      .reduce((sum, i) => sum + (i.paidRate ?? fallbackRate), 0);
    return { name: coach.name, totalHours, heuresFixes, reviewCount, privateDone, netAmount };
  });

  const periodLabel = formatMonthLabel(monthStart);
  return { rows, periodLabel };
}
