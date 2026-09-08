import { tenantPrisma } from "@/lib/prisma";
import {
  addDays,
  addMonths,
  formatDateISO,
  formatDayLabel,
  formatMonthLabel,
  isoWeekday,
  startOfWeekMonday,
} from "@/lib/dates";
import { classDurationHours } from "@/lib/coach-stats";
import { groupClassRate, PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";

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

  const [coaches, instances, planningWeek, weekReviews] = await Promise.all([
    tenant.coach.findMany({ orderBy: { name: "asc" } }),
    tenant.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd }, coachId: { not: null } },
    }),
    tenant.planningWeek.findUnique({ where: { organizationId_weekStart: { organizationId, weekStart } } }),
    tenant.classReview.findMany({
      where: { classInstance: { date: { gte: weekStart, lt: weekEnd } } },
      select: { id: true, classInstance: { select: { coachId: true } } },
    }),
  ]);
  const weekValidated = planningWeek !== null;

  const rows: DigestRow[] = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    // Same "all non-cancelled classes" basis as the dashboard's hours
    // columns — includes still-PLANNED classes, not just delivered ones.
    const activeCoachInstances = coachInstances.filter((i) => i.status !== "CANCELLED");
    const totalHours = activeCoachInstances.reduce(
      (sum, i) => sum + classDurationHours(i.startTime, i.endTime),
      0
    );
    const heuresFixes = activeCoachInstances
      .filter((i) => isoWeekday(i.date) <= 5)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    // Net € keys off delivered (DONE) classes, only once the week is
    // validated, paid at the rate snapshotted on each class (paidRate) —
    // same as week-dashboard.tsx.
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = weekReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    const fallbackRate = coach.rate ?? groupClassRate(coach.level);
    const groupAmount = weekValidated
      ? coachInstances
          .filter((i) => i.status === "DONE" && !i.isPrivate)
          .reduce(
            (sum, i) => sum + classDurationHours(i.startTime, i.endTime) * (i.paidRate ?? fallbackRate),
            0
          )
      : 0;
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
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

  const [coaches, instances, planningWeeks, monthReviews] = await Promise.all([
    tenant.coach.findMany({ orderBy: { name: "asc" } }),
    tenant.classInstance.findMany({
      where: { date: { gte: monthStart, lt: monthEnd }, coachId: { not: null } },
    }),
    // A calendar month's edge weeks can straddle the month boundary — same
    // reasoning as month-dashboard.tsx's own validatedWeekStarts.
    tenant.planningWeek.findMany({ select: { weekStart: true } }),
    tenant.classReview.findMany({
      where: { classInstance: { date: { gte: monthStart, lt: monthEnd } } },
      select: { id: true, classInstance: { select: { coachId: true } } },
    }),
  ]);
  const validatedWeekStarts = new Set(planningWeeks.map((w) => formatDateISO(w.weekStart)));

  const rows: DigestRow[] = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    const activeCoachInstances = coachInstances.filter((i) => i.status !== "CANCELLED");
    const totalHours = activeCoachInstances.reduce(
      (sum, i) => sum + classDurationHours(i.startTime, i.endTime),
      0
    );
    const heuresFixes = activeCoachInstances
      .filter((i) => isoWeekday(i.date) <= 5)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = monthReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    const fallbackRate = coach.rate ?? groupClassRate(coach.level);
    const groupAmount = coachInstances
      .filter(
        (i) =>
          i.status === "DONE" &&
          !i.isPrivate &&
          validatedWeekStarts.has(formatDateISO(startOfWeekMonday(i.date)))
      )
      .reduce(
        (sum, i) => sum + classDurationHours(i.startTime, i.endTime) * (i.paidRate ?? fallbackRate),
        0
      );
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
    return { name: coach.name, totalHours, heuresFixes, reviewCount, privateDone, netAmount };
  });

  const periodLabel = formatMonthLabel(monthStart);
  return { rows, periodLabel };
}
