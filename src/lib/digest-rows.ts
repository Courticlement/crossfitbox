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
    const done = coachInstances.filter((i) => i.status === "DONE" && !i.isPrivate).length;
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = weekReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    const groupAmount = weekValidated ? done * groupClassRate(coach.level) : 0;
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
    const done = coachInstances.filter((i) => i.status === "DONE" && !i.isPrivate);
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = monthReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    // Each DONE group class only pays out if the admin validated *its own*
    // week — a month can mix validated and not-yet-validated weeks, so
    // this is checked per class, not per month (same as month-dashboard.tsx).
    const rate = groupClassRate(coach.level);
    const groupAmount = done.reduce((sum, inst) => {
      const weekStartStr = formatDateISO(startOfWeekMonday(inst.date));
      return validatedWeekStarts.has(weekStartStr) ? sum + rate : sum;
    }, 0);
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
    return { name: coach.name, totalHours, heuresFixes, reviewCount, privateDone, netAmount };
  });

  const periodLabel = formatMonthLabel(monthStart);
  return { rows, periodLabel };
}
