import Link from "next/link";
import { DashboardCoachCards } from "@/components/dashboard-coach-cards";
import { MonthHoursChart, type CoachWeeklyHours } from "@/components/month-hours-chart";
import { tenantPrisma } from "@/lib/prisma";
import {
  startOfWeekMonday,
  addDays,
  addMonths,
  formatDateISO,
  formatMonthISO,
  formatMonthLabel,
  isoWeekday,
  parseMonthOnly,
  startOfMonth,
  toDateOnly,
} from "@/lib/dates";
import { classDurationHours } from "@/lib/coach-stats";
import { groupClassRate, PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";
import { chartSeriesColor } from "@/lib/chart-palette";

// The calendar weeks (Monday-start) a month overlaps — a month rarely
// starts on a Monday, so its first and/or last week here can extend outside
// [monthStart, monthEnd), which is fine: only that week's classes that
// actually fall within the month get bucketed into it below.
function monthWeekStarts(monthStart: Date, monthEnd: Date): Date[] {
  const weeks: Date[] = [];
  let w = startOfWeekMonday(monthStart);
  while (w < monthEnd) {
    weeks.push(w);
    w = addDays(w, 7);
  }
  return weeks;
}

function weekLabel(weekStart: Date): string {
  const day = String(weekStart.getUTCDate()).padStart(2, "0");
  const month = String(weekStart.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

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
  const monthStartStr = formatMonthISO(monthStart);
  const prevMonth = formatMonthISO(addMonths(monthStart, -1));
  const nextMonth = formatMonthISO(addMonths(monthStart, 1));

  const today = toDateOnly(new Date());

  const [coaches, instances, monthReviews, upcomingClasses] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
    }),
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

  const activeInstances = instances.filter((i) => i.status !== "CANCELLED");
  const totalClasses = activeInstances.length;
  // A team event never gets a coach by design (see ClassInstance.isTeamEvent)
  // — it shouldn't inflate the "needs assignment" count.
  const unassignedClasses = activeInstances.filter((i) => !i.coachId && !i.isTeamEvent).length;
  const groupClasses = activeInstances.filter((i) => !i.isPrivate).length;
  const privateClasses = activeInstances.filter((i) => i.isPrivate).length;

  const rows = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    // Hours are scheduled workload, not just delivered — every non-cancelled
    // class counts (planned or done, group or private) so the number
    // reflects the whole month, not just what's happened so far.
    const activeCoachInstances = coachInstances.filter((i) => i.status !== "CANCELLED");
    const totalHours = activeCoachInstances.reduce(
      (sum, i) => sum + classDurationHours(i.startTime, i.endTime),
      0
    );
    // "Heures fixes" — the regular Mon–Fri workload, set apart from weekend
    // classes (which skew private/ad hoc) since isoWeekday returns 1..5 for
    // Monday through Friday.
    const heuresFixes = activeCoachInstances
      .filter((i) => isoWeekday(i.date) <= 5)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    // Net € keys off delivered (DONE) classes, same as before — only the
    // hours columns above count scheduled-but-not-yet-done classes too. Paid
    // by the hour now (see Coach.rate), not per class.
    const doneHours = coachInstances
      .filter((i) => i.status === "DONE" && !i.isPrivate)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    const privateDone = coachInstances.filter(
      (i) => i.status === "DONE" && i.isPrivate
    ).length;
    const groupAmount = doneHours * (coach.rate ?? groupClassRate(coach.level));
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
      totalHours,
      heuresFixes,
      privateDone,
      reviewCount,
      lastReviewId,
      nextClass,
      nextClassWeekStart,
      netAmount,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.totalHours,
      heuresFixes: acc.heuresFixes + r.heuresFixes,
      privateDone: acc.privateDone + r.privateDone,
      reviewCount: acc.reviewCount + r.reviewCount,
      netAmount: acc.netAmount + r.netAmount,
    }),
    { totalHours: 0, heuresFixes: 0, privateDone: 0, reviewCount: 0, netAmount: 0 }
  );

  // Same non-cancelled classes as the table's Heure total / Heures fixes
  // columns, just bucketed by week instead of summed over the whole month —
  // feeds the line chart below.
  const weeks = monthWeekStarts(monthStart, monthEnd);
  const weekLabels = weeks.map(weekLabel);
  const weekIndexByStart = new Map(weeks.map((w, idx) => [formatDateISO(w), idx]));

  const weeklyByCoach = new Map<string, { total: number[]; fixes: number[] }>(
    coaches.map((coach) => [
      coach.id,
      { total: new Array(weeks.length).fill(0), fixes: new Array(weeks.length).fill(0) },
    ])
  );
  for (const inst of activeInstances) {
    if (!inst.coachId) continue;
    const entry = weeklyByCoach.get(inst.coachId);
    if (!entry) continue;
    const weekIdx = weekIndexByStart.get(formatDateISO(startOfWeekMonday(inst.date)));
    if (weekIdx === undefined) continue;
    const hours = classDurationHours(inst.startTime, inst.endTime);
    entry.total[weekIdx] += hours;
    if (isoWeekday(inst.date) <= 5) entry.fixes[weekIdx] += hours;
  }
  const weeklySeries: CoachWeeklyHours[] = coaches.map((coach, i) => {
    const entry = weeklyByCoach.get(coach.id)!;
    return {
      id: coach.id,
      name: coach.name,
      color: chartSeriesColor(i),
      totalHours: entry.total,
      heuresFixes: entry.fixes,
    };
  });

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
              <th className="px-4 py-2 font-medium" title="Total des heures de cours non annulés ce mois-ci (collectifs + privés, faits ou prévus)">
                Heure total
              </th>
              <th className="px-4 py-2 font-medium" title="Total des heures de cours non annulés du lundi au vendredi">
                Heures fixes
              </th>
              <th className="px-4 py-2 font-medium" title="Reviews de coaching ce mois-ci — clic sur le nombre pour voir la dernière, ou le prochain cours à observer">
                Review
              </th>
              <th className="px-4 py-2 font-medium">Privés</th>
              <th
                className="px-4 py-2 font-medium"
                title="Heures de cours collectifs marquées Fait, au tarif horaire du coach, moins le coût des cours privés"
              >
                Net €
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({
              coach,
              totalHours,
              heuresFixes,
              privateDone,
              reviewCount,
              lastReviewId,
              nextClass,
              nextClassWeekStart,
              netAmount,
            }) => (
              <tr key={coach.id} className="border-t border-neutral-800">
                <td className="px-4 py-2 text-white">{coach.name}</td>
                <td className="px-4 py-2 text-white">{totalHours.toFixed(1)}h</td>
                <td className="px-4 py-2 text-neutral-400">{heuresFixes.toFixed(1)}h</td>
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
                <td className="px-4 py-2 text-neutral-400">{privateDone}</td>
                <td className={`px-4 py-2 ${netAmount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {netAmount}€
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Aucun coach pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-700 bg-neutral-900 font-medium">
                <td className="px-4 py-2 text-white">Total</td>
                <td className="px-4 py-2 text-white">{totals.totalHours.toFixed(1)}h</td>
                <td className="px-4 py-2 text-neutral-400">{totals.heuresFixes.toFixed(1)}h</td>
                <td className="px-4 py-2 text-neutral-400">{totals.reviewCount}</td>
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

      <h2 className="mb-3 text-sm font-medium text-neutral-400">Heures par coach et par semaine</h2>
      <MonthHoursChart weekLabels={weekLabels} series={weeklySeries} />

      <form method="get" action="/admin/digest/month/pdf" className="mt-6">
        <input type="hidden" name="month" value={monthStartStr} />
        <button
          type="submit"
          className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Exporter le récapitulatif mensuel en PDF
        </button>
      </form>
    </>
  );
}
