import { prisma } from "@/lib/prisma";
import { createCoach, renameCoach, deleteCoach } from "@/lib/actions/coaches";
import { computeCoachStats } from "@/lib/coach-stats";

function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export default async function CoachesPage() {
  const [coaches, instances] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: { OR: [{ coachId: { not: null } }, { substituteCoachId: { not: null } }] },
      select: {
        coachId: true,
        substituteCoachId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        isPrivate: true,
      },
    }),
  ]);

  const instancesByCoach = new Map<string, typeof instances>();
  for (const inst of instances) {
    for (const id of [inst.coachId, inst.substituteCoachId]) {
      if (!id) continue;
      const list = instancesByCoach.get(id) ?? [];
      list.push(inst);
      instancesByCoach.set(id, list);
    }
  }

  return (
    <div className="text-neutral-300">
      <h1 className="mb-4 text-lg font-semibold text-white">Coaches</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((coach) => {
          const stats = computeCoachStats(coach.id, instancesByCoach.get(coach.id) ?? []);
          return (
            <div
              key={coach.id}
              className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-white">
                    {coach.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {coach.level || "Level not set"}
                  </div>
                </div>
                <form action={deleteCoach}>
                  <input type="hidden" name="id" value={coach.id} />
                  <button
                    type="submit"
                    className="shrink-0 text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </form>
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">Hours this month</dt>
                  <dd className="text-white">{formatHours(stats.hoursThisMonth)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Hours last month</dt>
                  <dd className="text-white">{formatHours(stats.hoursLastMonth)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Reliability rate</dt>
                  <dd className="text-white">{formatPercent(stats.reliabilityRate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Private classes done</dt>
                  <dd className="text-white">{stats.privateClassesDone}</dd>
                </div>
              </dl>

              <form
                action={renameCoach}
                className="mt-auto flex items-center gap-2 border-t border-neutral-800 pt-3"
              >
                <input type="hidden" name="id" value={coach.id} />
                <input
                  type="text"
                  name="name"
                  defaultValue={coach.name}
                  className="w-24 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
                />
                <input
                  type="text"
                  name="level"
                  defaultValue={coach.level ?? ""}
                  placeholder="Level"
                  className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-white placeholder:text-neutral-600 hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 text-xs text-neutral-500 hover:text-white"
                >
                  Save
                </button>
              </form>
            </div>
          );
        })}
        {coaches.length === 0 && (
          <p className="col-span-full py-6 text-center text-neutral-500">
            No coaches yet.
          </p>
        )}
      </div>

      <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-white">Add a coach</h2>
        <form action={createCoach} className="flex flex-col gap-2">
          <input
            type="text"
            name="name"
            required
            placeholder="Name"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <input
            type="text"
            name="level"
            placeholder="CrossFit level (e.g. CF-L1)"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Add coach
          </button>
        </form>
      </div>
    </div>
  );
}
