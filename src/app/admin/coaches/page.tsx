import { prisma } from "@/lib/prisma";
import {
  createCoach,
  renameCoach,
  deleteCoach,
  archiveCoach,
  unarchiveCoach,
} from "@/lib/actions/coaches";
import { computeCoachStats, type CoachStats } from "@/lib/coach-stats";
import { groupClassRate } from "@/lib/coach-levels";
import { LevelSelect } from "@/components/level-select";
import { ColorSelect } from "@/components/color-select";
import { PrevWeekBanner } from "@/components/prev-week-banner";
import { CoachPasswordForm } from "@/components/coach-password-form";
import { formatDateISO } from "@/lib/dates";

function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

function formatRate(level: string | null): string {
  return level ? `${groupClassRate(level)}€/h` : "—";
}

function formatAmount(amount: number): string {
  return `${amount}€`;
}

function formatCost(cost: number): string {
  return cost === 0 ? "0€" : `-${cost}€`;
}

// Shared card for both the active and archived sections below — an archived
// coach keeps their stats and access-link visible (for reference / handing
// the link back if unarchived) but loses the rename form, since there's
// nothing to keep editing once they're gone.
type CoachCardData = {
  id: string;
  name: string;
  level: string | null;
  color: string | null;
  weeklyQuota: number | null;
  passwordHash: string | null;
  archived: boolean;
};

function CoachCard({
  coach,
  stats,
  takenColors,
}: {
  coach: CoachCardData;
  stats: CoachStats;
  takenColors: Set<string>;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border p-4 ${
        coach.archived
          ? "border-neutral-800 bg-neutral-900/50 opacity-70"
          : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            {coach.color && (
              <span
                style={{ backgroundColor: coach.color }}
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                title="Planning color"
              />
            )}
            {coach.name}
            {coach.archived && (
              <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-neutral-500">
                Archived
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            {coach.level || "Level not set"}
            {" · "}
            {coach.weeklyQuota === null
              ? "No standard quota"
              : `${coach.weeklyQuota} classes/week`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {coach.archived ? (
            <form action={unarchiveCoach}>
              <input type="hidden" name="id" value={coach.id} />
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
              >
                Unarchive
              </button>
            </form>
          ) : (
            <form action={archiveCoach}>
              <input type="hidden" name="id" value={coach.id} />
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
              >
                Archive
              </button>
            </form>
          )}
          <form action={deleteCoach}>
            <input type="hidden" name="id" value={coach.id} />
            <button
              type="submit"
              className="rounded-md border border-neutral-800 px-2 py-1 text-xs text-red-400 hover:border-red-900 hover:text-red-300"
            >
              Remove
            </button>
          </form>
        </div>
      </div>

      <div className="mb-4 border-b border-neutral-800 pb-3">
        <CoachPasswordForm
          coachId={coach.id}
          hasPassword={coach.passwordHash !== null}
          disabled={coach.archived}
        />
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
          <dt className="text-xs text-neutral-500">Avg hours/month</dt>
          <dd className="text-white">
            {stats.averageHoursPerMonth === null
              ? "—"
              : formatHours(stats.averageHoursPerMonth)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500" title="Based on this coach's CrossFit level">
            Rate
          </dt>
          <dd className="text-white">{formatRate(coach.level)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Private classes done</dt>
          <dd className="text-white">{stats.privateClassesDone}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500" title="Group classes delivered in a week you've validated">
            Amount this month
          </dt>
          <dd className="text-white">{formatAmount(stats.amountThisMonth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500" title="Group classes delivered in a week you've validated">
            Amount last month
          </dt>
          <dd className="text-white">{formatAmount(stats.amountLastMonth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500" title="Owed to the box for private classes delivered this month">
            Private cost this month
          </dt>
          <dd className="text-red-400">{formatCost(stats.privateCostThisMonth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500" title="Owed to the box for private classes delivered last month">
            Private cost last month
          </dt>
          <dd className="text-red-400">{formatCost(stats.privateCostLastMonth)}</dd>
        </div>
      </dl>

      {!coach.archived && (
        <form
          action={renameCoach}
          className="mt-auto flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3"
        >
          <input type="hidden" name="id" value={coach.id} />
          <input
            type="text"
            name="name"
            defaultValue={coach.name}
            className="w-24 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
          />
          <LevelSelect name="level" defaultValue={coach.level ?? ""} />
          <input
            type="number"
            name="weeklyQuota"
            min={0}
            defaultValue={coach.weeklyQuota ?? ""}
            placeholder="Quota"
            title="Standard weekly quota — used on the Dashboard for any week without its own override"
            className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
          />
          <ColorSelect name="color" defaultValue={coach.color ?? ""} takenColors={takenColors} />
          <button
            type="submit"
            className="shrink-0 text-xs text-neutral-500 hover:text-white"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}

export default async function CoachesPage() {
  const [coaches, instances, planningWeeks] = await Promise.all([
    prisma.coach.findMany({ orderBy: [{ archived: "asc" }, { name: "asc" }] }),
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
    prisma.planningWeek.findMany({ select: { weekStart: true } }),
  ]);

  const validatedWeekStarts = new Set(planningWeeks.map((w) => formatDateISO(w.weekStart)));

  const instancesByCoach = new Map<string, typeof instances>();
  for (const inst of instances) {
    for (const id of [inst.coachId, inst.substituteCoachId]) {
      if (!id) continue;
      const list = instancesByCoach.get(id) ?? [];
      list.push(inst);
      instancesByCoach.set(id, list);
    }
  }

  const activeCoaches = coaches.filter((c) => !c.archived);
  const archivedCoaches = coaches.filter((c) => c.archived);
  const takenColorsExcept = (coachId: string) =>
    new Set(coaches.filter((c) => c.id !== coachId && c.color).map((c) => c.color!));

  return (
    <div className="text-neutral-300">
      <h1 className="mb-4 text-lg font-semibold text-white">Coaches</h1>
      <PrevWeekBanner />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeCoaches.map((coach) => (
          <CoachCard
            key={coach.id}
            coach={coach}
            stats={computeCoachStats(
              coach.id,
              instancesByCoach.get(coach.id) ?? [],
              coach.level,
              validatedWeekStarts
            )}
            takenColors={takenColorsExcept(coach.id)}
          />
        ))}
        {activeCoaches.length === 0 && (
          <p className="col-span-full py-6 text-center text-neutral-500">
            No coaches yet.
          </p>
        )}
      </div>

      {archivedCoaches.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">
            Archived ({archivedCoaches.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archivedCoaches.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                stats={computeCoachStats(
                  coach.id,
                  instancesByCoach.get(coach.id) ?? [],
                  coach.level,
                  validatedWeekStarts
                )}
                takenColors={takenColorsExcept(coach.id)}
              />
            ))}
          </div>
        </div>
      )}

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
          <div>
            <span className="mb-1 block text-xs text-neutral-500">CrossFit level</span>
            <LevelSelect name="level" defaultValue="" />
          </div>
          <div>
            <span className="mb-1 block text-xs text-neutral-500">
              Standard weekly quota
            </span>
            <input
              type="number"
              name="weeklyQuota"
              min={0}
              placeholder="e.g. 10"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </div>
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
