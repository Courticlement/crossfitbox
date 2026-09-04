import Link from "next/link";
import { DashboardCoachCards } from "@/components/dashboard-coach-cards";
import { tenantPrisma } from "@/lib/prisma";
import {
  startOfWeekMonday,
  addMonths,
  formatDateISO,
  formatMonthISO,
  formatMonthLabel,
  parseMonthOnly,
  startOfMonth,
  toDateOnly,
} from "@/lib/dates";
import { groupClassRate, PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";

export async function MonthDashboard({
  organizationId,
  monthParam,
}: {
  organizationId: string;
  monthParam?: string;
}) {
  const prisma = tenantPrisma(organizationId);
  const requested = (monthParam && parseMonthOnly(monthParam)) || toDateOnly(new Date());
  const monthStart = startOfMonth(requested);
  const monthEnd = addMonths(monthStart, 1);
  const prevMonth = formatMonthISO(addMonths(monthStart, -1));
  const nextMonth = formatMonthISO(addMonths(monthStart, 1));

  const today = toDateOnly(new Date());

  const [coaches, instances, planningWeeks, monthReviews, upcomingClasses] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
    }),
    // A calendar month's edge weeks can straddle the month boundary (e.g. a
    // week starting the last Monday of the prior month) — fetching every
    // validated week rather than just ones inside [monthStart, monthEnd)
    // means each class is still checked against its own actual week.
    prisma.planningWeek.findMany({ select: { weekStart: true } }),
    // Scoped to this month, same as Faits/Prévus below.
    prisma.classReview.findMany({
      where: {
        classInstance: { date: { gte: monthStart, lt: monthEnd } },
      },
      select: { id: true, classInstance: { select: { coachId: true, date: true } } },
      orderBy: { classInstance: { date: "desc" } },
    }),
    // A coach with no review this month links to their next scheduled class
    // instead — which can easily fall in a later month.
    prisma.classInstance.findMany({
      where: {
        coachId: { not: null },
        status: "PLANNED",
        date: { gte: today },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: { id: true, coachId: true, date: true, startTime: true, label: true },
    }),
  ]);
  const validatedWeekStarts = new Set(planningWeeks.map((w) => formatDateISO(w.weekStart)));

  const activeInstances = instances.filter((i) => i.status !== "CANCELLED");
  const totalClasses = activeInstances.length;
  // A team event never gets a coach by design (see ClassInstance.isTeamEvent)
  // — it shouldn't inflate the "needs assignment" count.
  const unassignedClasses = activeInstances.filter((i) => !i.coachId && !i.isTeamEvent).length;
  const groupClasses = activeInstances.filter((i) => !i.isPrivate).length;
  const privateClasses = activeInstances.filter((i) => i.isPrivate).length;

  const rows = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    const assigned = coachInstances.filter(
      (i) => i.status !== "CANCELLED" && !i.isPrivate
    ).length;
    const done = coachInstances.filter((i) => i.status === "DONE" && !i.isPrivate);
    const missed = coachInstances.filter((i) => i.status === "MISSED" && !i.isPrivate).length;
    const planned = coachInstances.filter((i) => i.status === "PLANNED" && !i.isPrivate).length;
    const privateDone = coachInstances.filter(
      (i) => i.status === "DONE" && i.isPrivate
    ).length;
    const hasMissed = missed > 0;
    // Each DONE group class only pays out if the admin validated *its own*
    // week (see validateWeek) — a month can mix validated and
    // not-yet-validated weeks, so this is checked per class, not per month.
    const rate = groupClassRate(coach.level);
    const groupAmount = done.reduce((sum, inst) => {
      const weekStartStr = formatDateISO(startOfWeekMonday(inst.date));
      return validatedWeekStarts.has(weekStartStr) ? sum + rate : sum;
    }, 0);
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
    // This coach's reviews this month, most recent first.
    const coachReviews = monthReviews.filter((r) => r.classInstance.coachId === coach.id);
    const reviewCount = coachReviews.length;
    const lastReviewId = coachReviews[0]?.id ?? null;
    // No review yet this month — point at their next scheduled class.
    const nextClass = reviewCount === 0 ? (upcomingClasses.find((i) => i.coachId === coach.id) ?? null) : null;
    const nextClassWeekStart = nextClass ? formatDateISO(startOfWeekMonday(nextClass.date)) : null;
    return {
      coach,
      assigned,
      done: done.length,
      missed,
      planned,
      privateDone,
      reviewCount,
      lastReviewId,
      nextClass,
      nextClassWeekStart,
      hasMissed,
      netAmount,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      assigned: acc.assigned + r.assigned,
      done: acc.done + r.done,
      missed: acc.missed + r.missed,
      planned: acc.planned + r.planned,
      privateDone: acc.privateDone + r.privateDone,
      reviewCount: acc.reviewCount + r.reviewCount,
      netAmount: acc.netAmount + r.netAmount,
    }),
    { assigned: 0, done: 0, missed: 0, planned: 0, privateDone: 0, reviewCount: 0, netAmount: 0 }
  );

  return (
    <>
      <div className="mb-6 flex items-center gap-3 text-sm">
        <Link
          href={`/admin?view=month&month=${prevMonth}`}
          className="text-neutral-400 hover:text-white"
        >
          ← Préc.
        </Link>
        <span className="text-neutral-500">{formatMonthLabel(monthStart)}</span>
        <Link
          href={`/admin?view=month&month=${nextMonth}`}
          className="text-neutral-400 hover:text-white"
        >
          Suivant →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Cours ce mois-ci</dt>
          <dd className="text-2xl font-semibold text-white">{totalClasses}</dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Non assignés</dt>
          <dd
            className={`text-2xl font-semibold ${
              unassignedClasses > 0 ? "text-amber-400" : "text-white"
            }`}
          >
            {unassignedClasses}
          </dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Cours collectifs</dt>
          <dd className="text-2xl font-semibold text-white">{groupClasses}</dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Cours privés</dt>
          <dd className="text-2xl font-semibold text-white">{privateClasses}</dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Net €</dt>
          <dd
            className={`text-2xl font-semibold ${
              totals.netAmount < 0 ? "text-red-400" : "text-white"
            }`}
          >
            {totals.netAmount}€
          </dd>
        </div>
      </div>

      <DashboardCoachCards rows={rows} />

      <div className="mb-6 hidden overflow-hidden rounded-lg border border-neutral-800 md:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium" title="Cours collectifs assignés ce mois-ci">
                Assignés (collectif)
              </th>
              <th className="px-4 py-2 font-medium">Faits</th>
              <th className="px-4 py-2 font-medium">Prévus</th>
              <th className="px-4 py-2 font-medium" title="Reviews de coaching ce mois-ci — clic sur le nombre pour voir la dernière, ou le prochain cours à observer">
                Review
              </th>
              <th className="px-4 py-2 font-medium">Alerte</th>
              <th className="px-4 py-2 font-medium">Privés</th>
              <th
                className="px-4 py-2 font-medium"
                title="Le montant collectif ne compte que les cours d'une semaine validée par l'admin, moins le coût des cours privés"
              >
                Net €
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({
              coach,
              assigned,
              done,
              missed,
              planned,
              privateDone,
              reviewCount,
              lastReviewId,
              nextClass,
              nextClassWeekStart,
              hasMissed,
              netAmount,
            }) => (
              <tr key={coach.id} className="border-t border-neutral-800">
                <td className="px-4 py-2 text-white">{coach.name}</td>
                <td className="px-4 py-2">{assigned}</td>
                <td className="px-4 py-2 text-emerald-400">{done}</td>
                <td className="px-4 py-2 text-neutral-400">{planned}</td>
                <td className="px-4 py-2">
                  {reviewCount > 0 ? (
                    <Link
                      href={`/admin/reviews/${lastReviewId}`}
                      title="Voir la dernière review de ce coach ce mois-ci"
                      className="font-medium text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 hover:text-emerald-300"
                    >
                      {reviewCount}
                    </Link>
                  ) : nextClass && nextClassWeekStart ? (
                    <Link
                      href={`/admin/planning?week=${nextClassWeekStart}&highlight=${nextClass.id}`}
                      title="Aucune review ce mois-ci — voir le prochain cours de ce coach"
                      className="font-medium text-amber-400 underline decoration-amber-400/40 underline-offset-4 hover:text-amber-300"
                    >
                      0
                    </Link>
                  ) : (
                    <span className="text-neutral-500">0</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {hasMissed && (
                    <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                      {missed} manqué{missed === 1 ? "" : "s"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-400">{privateDone}</td>
                <td className={`px-4 py-2 ${netAmount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {netAmount}€
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                  Aucun coach pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-700 bg-neutral-900 font-medium">
                <td className="px-4 py-2 text-white">Total</td>
                <td className="px-4 py-2 text-white">{totals.assigned}</td>
                <td className="px-4 py-2 text-emerald-400">{totals.done}</td>
                <td className="px-4 py-2 text-neutral-400">{totals.planned}</td>
                <td className="px-4 py-2 text-neutral-400">{totals.reviewCount}</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-neutral-400">{totals.privateDone}</td>
                <td
                  className={`px-4 py-2 ${totals.netAmount < 0 ? "text-red-400" : "text-emerald-400"}`}
                >
                  {totals.netAmount}€
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
