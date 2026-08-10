import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
import { validateWeek } from "@/lib/actions/planning";
import { getPrevWeekAlert } from "@/lib/prev-week-alert";
import { groupClassRate, PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";

const PRIVATE_CLASS_WEEKLY_LIMIT = 10;

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  const weekParam = typeof params?.week === "string" ? params.week : undefined;
  const requested = (weekParam && parseDateOnly(weekParam)) || toDateOnly(new Date());
  const weekStart = startOfWeekMonday(requested);
  const weekEnd = addDays(weekStart, 7);
  const prevWeek = formatDateISO(addDays(weekStart, -7));
  const nextWeek = formatDateISO(addDays(weekStart, 7));
  const weekStartStr = formatDateISO(weekStart);
  const digestStatus = typeof params?.digest === "string" ? params.digest : undefined;

  const [coaches, instances, quotas, planningWeek, prevWeekAlert] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    // Unfiltered by coach on purpose — the box-wide summary below needs
    // unassigned classes too, not just ones already claimed by someone.
    prisma.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.coachWeeklyQuota.findMany({ where: { weekStart } }),
    prisma.planningWeek.findUnique({ where: { weekStart } }),
    getPrevWeekAlert(),
  ]);
  const weekValidated = planningWeek !== null;

  const activeInstances = instances.filter((i) => i.status !== "CANCELLED");
  const totalClasses = activeInstances.length;
  const unassignedClasses = activeInstances.filter((i) => !i.coachId).length;
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
    // Classes this coach covered for someone else who missed theirs — not
    // counted in `done` above, since that's scoped to this coach's own
    // assigned classes (see the coachInstances filter above).
    const substituted = instances.filter((i) => i.substituteCoachId === coach.id).length;
    const quota = quotas.find((q) => q.coachId === coach.id)?.maxLessons ?? null;
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
      substituted,
      quota,
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
      substituted: acc.substituted + r.substituted,
      planned: acc.planned + r.planned,
      privateDone: acc.privateDone + r.privateDone,
      netAmount: acc.netAmount + r.netAmount,
    }),
    {
      quota: 0,
      hasQuota: false,
      assigned: 0,
      done: 0,
      missed: 0,
      substituted: 0,
      planned: 0,
      privateDone: 0,
      netAmount: 0,
    }
  );

  return (
    <div className="text-neutral-300">
      {prevWeekAlert.show && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border-2 border-red-600 bg-red-950 p-5 shadow-lg shadow-red-950/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg text-white">
              !
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                {prevWeekAlert.unreported > 0
                  ? "Coaches haven't finished reporting last week"
                  : "Last week is ready to validate"}
              </h2>
              <p className="mt-1 text-sm text-red-200">
                {formatDayLabel(prevWeekAlert.prevWeekStart)} –{" "}
                {formatDayLabel(addDays(prevWeekAlert.prevWeekStart, 6))}
                {prevWeekAlert.unreported > 0
                  ? ` — ${prevWeekAlert.unreported} class${prevWeekAlert.unreported === 1 ? "" : "es"} still not reported.`
                  : " — every class is reported. Validate to lock it in."}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {prevWeekAlert.unreported > 0 ? (
              <Link
                href={`/admin/planning?week=${formatDateISO(prevWeekAlert.prevWeekStart)}`}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                Review →
              </Link>
            ) : (
              <form action={validateWeek}>
                <input
                  type="hidden"
                  name="weekStart"
                  value={formatDateISO(prevWeekAlert.prevWeekStart)}
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Validate →
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin?week=${prevWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            ← Prev
          </Link>
          <span className="text-neutral-500">
            {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
          </span>
          <Link
            href={`/admin?week=${nextWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Classes this week</dt>
          <dd className="text-2xl font-semibold text-white">{totalClasses}</dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Unassigned</dt>
          <dd
            className={`text-2xl font-semibold ${
              unassignedClasses > 0 ? "text-amber-400" : "text-white"
            }`}
          >
            {unassignedClasses}
          </dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Group classes</dt>
          <dd className="text-2xl font-semibold text-white">{groupClasses}</dd>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <dt className="text-xs text-neutral-500">Private classes</dt>
          <dd className="text-2xl font-semibold text-white">{privateClasses}</dd>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium">Quota</th>
              <th className="px-4 py-2 font-medium" title="Group classes assigned — private lessons don't count against quota">
                Assigned (Group)
              </th>
              <th className="px-4 py-2 font-medium">Done</th>
              <th className="px-4 py-2 font-medium">Missed</th>
              <th className="px-4 py-2 font-medium">Substituted</th>
              <th className="px-4 py-2 font-medium">Planned</th>
              <th className="px-4 py-2 font-medium">Alert</th>
              <th className="px-4 py-2 font-medium">Private</th>
              <th
                className="px-4 py-2 font-medium"
                title={
                  weekValidated
                    ? "Group amount minus private class cost"
                    : "Group amount is 0 until this week is validated — showing private cost only"
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
              substituted,
              quota,
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
                      className="w-16 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white focus:border-neutral-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="text-xs text-neutral-500 hover:text-white"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td className={`px-4 py-2 ${overQuota ? "text-red-400" : ""}`}>
                  {assigned}
                  {quota !== null && <span className="text-neutral-500">/{quota}</span>}
                </td>
                <td className="px-4 py-2 text-emerald-400">{done}</td>
                <td className="px-4 py-2 text-red-400">{missed}</td>
                <td className="px-4 py-2 text-sky-400">{substituted}</td>
                <td className="px-4 py-2 text-neutral-400">{planned}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-col items-start gap-1">
                    {overQuota && (
                      <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                        Over quota ({assigned}/{quota})
                      </span>
                    )}
                    {underQuota && (
                      <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                        Under quota ({assigned}/{quota})
                      </span>
                    )}
                    {hasMissed && (
                      <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                        {missed} missed
                      </span>
                    )}
                    {privateOverLimit && (
                      <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                        {privateDone} private classes (&gt;{PRIVATE_CLASS_WEEKLY_LIMIT})
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
                <td colSpan={10} className="px-4 py-6 text-center text-neutral-500">
                  No coaches yet.
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

      {digestStatus === "sent" && (
        <p className="mb-3 rounded-md border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          Digest email sent.
        </p>
      )}
      {digestStatus === "error" && (
        <p className="mb-3 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
          Could not send the digest. Check RESEND_API_KEY and DIGEST_EMAIL_TO
          in .env.
        </p>
      )}
      <form action={sendWeeklyDigest}>
        <input type="hidden" name="weekStart" value={weekStartStr} />
        <button
          type="submit"
          className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Send weekly digest email
        </button>
      </form>
    </div>
  );
}
