import Link from "next/link";
import { prisma } from "@/lib/prisma";
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

export async function MonthDashboard({ monthParam }: { monthParam?: string }) {
  const requested = (monthParam && parseMonthOnly(monthParam)) || toDateOnly(new Date());
  const monthStart = startOfMonth(requested);
  const monthEnd = addMonths(monthStart, 1);
  const prevMonth = formatMonthISO(addMonths(monthStart, -1));
  const nextMonth = formatMonthISO(addMonths(monthStart, 1));

  const [coaches, instances, planningWeeks] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
    }),
    // A calendar month's edge weeks can straddle the month boundary (e.g. a
    // week starting the last Monday of the prior month) — fetching every
    // validated week rather than just ones inside [monthStart, monthEnd)
    // means each class is still checked against its own actual week.
    prisma.planningWeek.findMany({ select: { weekStart: true } }),
  ]);
  const validatedWeekStarts = new Set(planningWeeks.map((w) => formatDateISO(w.weekStart)));

  const activeInstances = instances.filter((i) => i.status !== "CANCELLED");
  const totalClasses = activeInstances.length;
  const unassignedClasses = activeInstances.filter((i) => !i.coachId).length;
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
    const substituted = instances.filter((i) => i.substituteCoachId === coach.id).length;
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
    return {
      coach,
      assigned,
      done: done.length,
      missed,
      planned,
      privateDone,
      substituted,
      hasMissed,
      netAmount,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      assigned: acc.assigned + r.assigned,
      done: acc.done + r.done,
      missed: acc.missed + r.missed,
      substituted: acc.substituted + r.substituted,
      planned: acc.planned + r.planned,
      privateDone: acc.privateDone + r.privateDone,
      netAmount: acc.netAmount + r.netAmount,
    }),
    { assigned: 0, done: 0, missed: 0, substituted: 0, planned: 0, privateDone: 0, netAmount: 0 }
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

      <div className="mb-6 grid grid-cols-5 gap-4">
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

      <div className="mb-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium" title="Cours collectifs assignés ce mois-ci">
                Assignés (collectif)
              </th>
              <th className="px-4 py-2 font-medium">Faits</th>
              <th className="px-4 py-2 font-medium">Manqués</th>
              <th className="px-4 py-2 font-medium">Remplacés</th>
              <th className="px-4 py-2 font-medium">Prévus</th>
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
              substituted,
              hasMissed,
              netAmount,
            }) => (
              <tr key={coach.id} className="border-t border-neutral-800">
                <td className="px-4 py-2 text-white">{coach.name}</td>
                <td className="px-4 py-2">{assigned}</td>
                <td className="px-4 py-2 text-emerald-400">{done}</td>
                <td className="px-4 py-2 text-red-400">{missed}</td>
                <td className="px-4 py-2 text-sky-400">{substituted}</td>
                <td className="px-4 py-2 text-neutral-400">{planned}</td>
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
                <td className="px-4 py-2 text-white">{totals.assigned}</td>
                <td className="px-4 py-2 text-emerald-400">{totals.done}</td>
                <td className="px-4 py-2 text-red-400">{totals.missed}</td>
                <td className="px-4 py-2 text-sky-400">{totals.substituted}</td>
                <td className="px-4 py-2 text-neutral-400">{totals.planned}</td>
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
