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

  const [coaches, instances, quotas] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: {
        date: { gte: weekStart, lt: weekEnd },
        OR: [{ coachId: { not: null } }, { substituteCoachId: { not: null } }],
      },
    }),
    prisma.coachWeeklyQuota.findMany({ where: { weekStart } }),
  ]);

  const rows = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    const assigned = coachInstances.filter((i) => i.status !== "CANCELLED").length;
    const done = coachInstances.filter((i) => i.status === "DONE").length;
    const missed = coachInstances.filter((i) => i.status === "MISSED").length;
    const planned = coachInstances.filter((i) => i.status === "PLANNED").length;
    const privateDone = coachInstances.filter(
      (i) => i.status === "DONE" && i.isPrivate
    ).length;
    // Classes this coach covered for someone else who missed theirs — not
    // counted in `done` above, since that's scoped to this coach's own
    // assigned classes (see the coachInstances filter above).
    const substituted = instances.filter((i) => i.substituteCoachId === coach.id).length;
    const quota = quotas.find((q) => q.coachId === coach.id)?.maxLessons ?? null;
    const overQuota = quota !== null && assigned > quota;
    return { coach, assigned, done, missed, planned, privateDone, substituted, quota, overQuota };
  });

  return (
    <div className="text-neutral-300">
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

      <div className="mb-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium">Quota</th>
              <th className="px-4 py-2 font-medium">Assigned</th>
              <th className="px-4 py-2 font-medium">Done</th>
              <th className="px-4 py-2 font-medium">Missed</th>
              <th className="px-4 py-2 font-medium">Substituted</th>
              <th className="px-4 py-2 font-medium">Planned</th>
              <th className="px-4 py-2 font-medium">Private</th>
              <th className="px-4 py-2 font-medium">Alert</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ coach, assigned, done, missed, planned, privateDone, substituted, quota, overQuota }) => (
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
                <td className="px-4 py-2">{assigned}</td>
                <td className="px-4 py-2 text-emerald-400">{done}</td>
                <td className="px-4 py-2 text-red-400">{missed}</td>
                <td className="px-4 py-2 text-sky-400">{substituted}</td>
                <td className="px-4 py-2 text-neutral-400">{planned}</td>
                <td className="px-4 py-2 text-neutral-400">{privateDone}</td>
                <td className="px-4 py-2">
                  {overQuota && (
                    <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                      Over quota ({assigned}/{quota})
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500">
                  No coaches yet.
                </td>
              </tr>
            )}
          </tbody>
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
