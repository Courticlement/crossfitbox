import Link from "next/link";
import { DashboardCoachCards } from "@/components/dashboard-coach-cards";
import { tenantPrisma } from "@/lib/prisma";
import {
  startOfWeekMonday,
  addDays,
  formatDateISO,
  formatDayLabel,
  isoWeekday,
  parseDateOnly,
  toDateOnly,
} from "@/lib/dates";
import { classDurationHours } from "@/lib/coach-stats";
import { groupClassRate, PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";

export async function WeekDashboard({
  organizationId,
  weekParam,
}: {
  organizationId: string;
  weekParam?: string;
}) {
  const prisma = tenantPrisma(organizationId);
  const requested = (weekParam && parseDateOnly(weekParam)) || toDateOnly(new Date());
  const weekStart = startOfWeekMonday(requested);
  const weekEnd = addDays(weekStart, 7);
  const prevWeek = formatDateISO(addDays(weekStart, -7));
  const nextWeek = formatDateISO(addDays(weekStart, 7));
  const weekStartStr = formatDateISO(weekStart);

  const today = toDateOnly(new Date());

  const [coaches, instances, weekReviews, upcomingClasses] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    // Unfiltered by coach on purpose — the box-wide summary below needs
    // unassigned classes too, not just ones already claimed by someone.
    prisma.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
    // Scoped to this week, same as Faits/Prévus below — the count in the
    // Review column and the "last review" it links to both come from here.
    prisma.classReview.findMany({
      where: {
        classInstance: { date: { gte: weekStart, lt: weekEnd } },
      },
      select: { id: true, classInstance: { select: { coachId: true, date: true } } },
      orderBy: { classInstance: { date: "desc" } },
    }),
    // A coach with no review this week links to their next scheduled class
    // instead — which can easily fall in a different, later week.
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
    // reflects the whole week, not just what's happened so far.
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
    // This coach's reviews this week, most recent first (see the
    // orderBy above) — the count is the cell's value, the first entry is
    // what "voir la dernière" links to.
    const coachReviews = weekReviews.filter((r) => r.classInstance.coachId === coach.id);
    const reviewCount = coachReviews.length;
    const lastReviewId = coachReviews[0]?.id ?? null;
    // No review yet this week — point at their next scheduled class instead
    // (upcomingClasses is sorted soonest-first, so the first match is it).
    const nextClass = reviewCount === 0 ? (upcomingClasses.find((i) => i.coachId === coach.id) ?? null) : null;
    const nextClassWeekStart = nextClass ? formatDateISO(startOfWeekMonday(nextClass.date)) : null;
    // Group classes are paid on the hours the head coach has marked Fait
    // (see bulkSetClassStatus) — private classes are always costed, since
    // they're logged ad hoc outside the weekly planning workflow.
    const groupAmount = doneHours * (coach.rate ?? groupClassRate(coach.level));
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
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
    {
      totalHours: 0,
      heuresFixes: 0,
      privateDone: 0,
      reviewCount: 0,
      netAmount: 0,
    }
  );

  return (
    <>
      <div className="mb-6 flex items-center gap-3 text-sm">
        <Link
          href={`/admin?view=week&week=${prevWeek}`}
          className="text-neutral-400 hover:text-white"
        >
          ← Préc.
        </Link>
        <span className="text-neutral-500">
          {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
        </span>
        <Link
          href={`/admin?view=week&week=${nextWeek}`}
          className="text-neutral-400 hover:text-white"
        >
          Suivant →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Cours cette semaine</dt>
          <dd className="text-2xl font-semibold text-white">{totalClasses}</dd>
        </div>
        {unassignedClasses > 0 ? (
          <Link
            href={`/admin/planning?week=${weekStartStr}`}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-amber-700"
          >
            <dt className="text-xs text-neutral-500">Non assignés</dt>
            <dd className="text-2xl font-semibold text-amber-400 underline decoration-amber-400/40 underline-offset-4">
              {unassignedClasses}
            </dd>
          </Link>
        ) : (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <dt className="text-xs text-neutral-500">Non assignés</dt>
            <dd className="text-2xl font-semibold text-white">{unassignedClasses}</dd>
          </div>
        )}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Cours collectifs</dt>
          <dd className="text-2xl font-semibold text-white">{groupClasses}</dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Cours privés</dt>
          <dd className="text-2xl font-semibold text-white">{privateClasses}</dd>
        </div>
      </div>

      <DashboardCoachCards rows={rows} />

      <div className="mb-6 hidden overflow-hidden rounded-lg border border-neutral-800 md:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium" title="Total des heures de cours non annulés cette semaine (collectifs + privés, faits ou prévus)">
                Heure total
              </th>
              <th className="px-4 py-2 font-medium" title="Total des heures de cours non annulés du lundi au vendredi">
                Heures fixes
              </th>
              <th className="px-4 py-2 font-medium" title="Reviews de coaching cette semaine — clic sur le nombre pour voir la dernière, ou le prochain cours à observer">
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
                      title="Voir la dernière review de ce coach cette semaine"
                      className="font-medium text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 hover:text-emerald-300"
                    >
                      {reviewCount}
                    </Link>
                  ) : nextClass && nextClassWeekStart ? (
                    <Link
                      href={`/admin/planning?week=${nextClassWeekStart}&highlight=${nextClass.id}`}
                      title="Aucune review cette semaine — voir le prochain cours de ce coach"
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

      <form method="get" action="/admin/digest/week/pdf">
        <input type="hidden" name="week" value={weekStartStr} />
        <button
          type="submit"
          className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Exporter le récapitulatif hebdomadaire en PDF
        </button>
      </form>
    </>
  );
}
