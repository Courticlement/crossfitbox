import Link from "next/link";
import { DashboardCoachCards } from "@/components/dashboard-coach-cards";
import { tenantPrisma } from "@/lib/prisma";
import {
  startOfWeekMonday,
  addDays,
  formatDateISO,
  formatDayLabel,
  parseDateOnly,
  toDateOnly,
} from "@/lib/dates";
import { setQuota } from "@/lib/actions/quotas";
import { sendWeeklyDigest } from "@/lib/actions/digest";
import { groupClassRate, PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";

const PRIVATE_CLASS_WEEKLY_LIMIT = 10;

export async function WeekDashboard({
  organizationId,
  weekParam,
  digestStatus,
}: {
  organizationId: string;
  weekParam?: string;
  digestStatus?: string;
}) {
  const prisma = tenantPrisma(organizationId);
  const requested = (weekParam && parseDateOnly(weekParam)) || toDateOnly(new Date());
  const weekStart = startOfWeekMonday(requested);
  const weekEnd = addDays(weekStart, 7);
  const prevWeek = formatDateISO(addDays(weekStart, -7));
  const nextWeek = formatDateISO(addDays(weekStart, 7));
  const weekStartStr = formatDateISO(weekStart);

  const today = toDateOnly(new Date());

  const [coaches, instances, quotas, planningWeek, weekReviews, upcomingClasses] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    // Unfiltered by coach on purpose — the box-wide summary below needs
    // unassigned classes too, not just ones already claimed by someone.
    prisma.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.coachWeeklyQuota.findMany({ where: { weekStart } }),
    prisma.planningWeek.findUnique({ where: { organizationId_weekStart: { organizationId, weekStart } } }),
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
  const weekValidated = planningWeek !== null;

  const activeInstances = instances.filter((i) => i.status !== "CANCELLED");
  const totalClasses = activeInstances.length;
  // A team event never gets a coach by design (see ClassInstance.isTeamEvent)
  // — it shouldn't inflate the "needs assignment" count.
  const unassignedClasses = activeInstances.filter((i) => !i.coachId && !i.isTeamEvent).length;
  const groupClasses = activeInstances.filter((i) => !i.isPrivate).length;
  const privateClasses = activeInstances.filter((i) => i.isPrivate).length;

  const rows = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    // Quota is a cap on group classes only — private lessons are booked ad
    // hoc on top of the regular schedule and never count against it, so
    // Assigned/Done/Missed/Planned here (and the quota check below) are all
    // scoped to group classes. Private classes are always created already
    // DONE (see addPrivateClass), so they get their own total instead.
    const assigned = coachInstances.filter(
      (i) => i.status !== "CANCELLED" && !i.isPrivate
    ).length;
    const done = coachInstances.filter((i) => i.status === "DONE" && !i.isPrivate).length;
    const missed = coachInstances.filter((i) => i.status === "MISSED" && !i.isPrivate).length;
    const planned = coachInstances.filter((i) => i.status === "PLANNED" && !i.isPrivate).length;
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
    // A week-specific override always wins; otherwise fall back to the
    // coach's standard weekly quota set on their Id card (see
    // /admin/coaches) — so a coach's usual quota applies automatically
    // without the admin having to re-enter it every week.
    const weeklyOverride = quotas.find((q) => q.coachId === coach.id)?.maxLessons ?? null;
    const quota = weeklyOverride ?? coach.weeklyQuota ?? null;
    const isStandardQuota = weeklyOverride === null && coach.weeklyQuota !== null;
    const overQuota = quota !== null && assigned > quota;
    const underQuota = quota !== null && assigned < quota;
    const hasMissed = missed > 0;
    const privateOverLimit = privateDone > PRIVATE_CLASS_WEEKLY_LIMIT;
    // Group classes only pay out once the admin has validated this week
    // (see validateWeek) — private classes are always costed, validated or
    // not, since they're logged ad hoc outside the planning workflow.
    const groupAmount = weekValidated ? done * groupClassRate(coach.level) : 0;
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
    return {
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
      quota,
      isStandardQuota,
      overQuota,
      underQuota,
      hasMissed,
      privateOverLimit,
      netAmount,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      quota: acc.quota + (r.quota ?? 0),
      hasQuota: acc.hasQuota || r.quota !== null,
      assigned: acc.assigned + r.assigned,
      done: acc.done + r.done,
      missed: acc.missed + r.missed,
      planned: acc.planned + r.planned,
      privateDone: acc.privateDone + r.privateDone,
      reviewCount: acc.reviewCount + r.reviewCount,
      netAmount: acc.netAmount + r.netAmount,
    }),
    {
      quota: 0,
      hasQuota: false,
      assigned: 0,
      done: 0,
      missed: 0,
      planned: 0,
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
              <th className="px-4 py-2 font-medium">Quota</th>
              <th className="px-4 py-2 font-medium" title="Cours collectifs assignés — les cours privés ne comptent pas dans le quota">
                Assignés (collectif)
              </th>
              <th className="px-4 py-2 font-medium">Faits</th>
              <th className="px-4 py-2 font-medium">Prévus</th>
              <th className="px-4 py-2 font-medium" title="Reviews de coaching cette semaine — clic sur le nombre pour voir la dernière, ou le prochain cours à observer">
                Review
              </th>
              <th className="px-4 py-2 font-medium">Alerte</th>
              <th className="px-4 py-2 font-medium">Privés</th>
              <th
                className="px-4 py-2 font-medium"
                title={
                  weekValidated
                    ? "Montant collectif moins le coût des cours privés"
                    : "Le montant collectif est à 0 tant que la semaine n'est pas validée — coût des cours privés uniquement"
                }
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
              quota,
              isStandardQuota,
              overQuota,
              underQuota,
              hasMissed,
              privateOverLimit,
              netAmount,
            }) => (
              <tr key={coach.id} className="border-t border-neutral-800">
                <td className="px-4 py-2 text-white">{coach.name}</td>
                <td className="px-4 py-2">
                  <form action={setQuota} className="flex items-center gap-2">
                    <input type="hidden" name="coachId" value={coach.id} />
                    <input type="hidden" name="weekStart" value={weekStartStr} />
                    <input
                      type="number"
                      name="maxLessons"
                      min={0}
                      defaultValue={quota ?? ""}
                      placeholder="—"
                      title={
                        isStandardQuota
                          ? "Hérité du quota hebdomadaire standard de ce coach — enregistrer ici crée une exception pour cette semaine uniquement"
                          : undefined
                      }
                      className="w-16 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white focus:border-neutral-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="text-xs text-neutral-500 hover:text-white"
                    >
                      Enregistrer
                    </button>
                    {isStandardQuota && (
                      <span className="text-xs text-neutral-600">(standard)</span>
                    )}
                  </form>
                </td>
                <td className={`px-4 py-2 ${overQuota ? "text-red-400" : ""}`}>
                  {assigned}
                  {quota !== null && <span className="text-neutral-500">/{quota}</span>}
                </td>
                <td className="px-4 py-2 text-emerald-400">{done}</td>
                <td className="px-4 py-2 text-neutral-400">{planned}</td>
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
                <td className="px-4 py-2">
                  <div className="flex flex-col items-start gap-1">
                    {overQuota && (
                      <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                        Quota dépassé ({assigned}/{quota})
                      </span>
                    )}
                    {underQuota && (
                      <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                        Quota non atteint ({assigned}/{quota})
                      </span>
                    )}
                    {hasMissed && (
                      <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                        {missed} manqué{missed === 1 ? "" : "s"}
                      </span>
                    )}
                    {privateOverLimit && (
                      <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                        {privateDone} cours privés (&gt;{PRIVATE_CLASS_WEEKLY_LIMIT})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-neutral-400">{privateDone}</td>
                <td className={`px-4 py-2 ${netAmount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {netAmount}€
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500">
                  Aucun coach pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-700 bg-neutral-900 font-medium">
                <td className="px-4 py-2 text-white">Total</td>
                <td className="px-4 py-2 text-white">{totals.hasQuota ? totals.quota : "—"}</td>
                <td
                  className={`px-4 py-2 ${
                    totals.hasQuota && totals.assigned > totals.quota
                      ? "text-red-400"
                      : "text-white"
                  }`}
                >
                  {totals.assigned}
                  {totals.hasQuota && <span className="text-neutral-500">/{totals.quota}</span>}
                </td>
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

      {digestStatus === "sent" && (
        <p className="mb-3 rounded-md border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          E-mail récapitulatif envoyé.
        </p>
      )}
      {digestStatus === "error" && (
        <p className="mb-3 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
          Impossible d&apos;envoyer le récapitulatif. Vérifiez RESEND_API_KEY
          et DIGEST_EMAIL_TO dans .env.
        </p>
      )}
      <form action={sendWeeklyDigest}>
        <input type="hidden" name="weekStart" value={weekStartStr} />
        <button
          type="submit"
          className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Envoyer le récapitulatif hebdomadaire par e-mail
        </button>
      </form>
    </>
  );
}
