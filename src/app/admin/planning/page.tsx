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
import { CoachSelect } from "@/components/coach-select";
import { ConflictsPanel, type ConflictInstance } from "@/components/conflicts-panel";
import { MissedClassesPanel } from "@/components/missed-classes-panel";
import { PlanningFilters } from "@/components/planning-filters";
import { ResetWeekButton } from "@/components/reset-week-button";
import { TimeConflictsPanel, type TimeConflictGroup } from "@/components/time-conflicts-panel";
import { WeekGrid } from "@/components/week-grid";
import { ROOMS } from "@/lib/rooms";
import {
  generateWeek,
  addAdHocClass,
  deleteClassInstance,
} from "@/lib/actions/planning";

export default async function PlanningPage({
  searchParams,
}: PageProps<"/admin/planning">) {
  const params = await searchParams;
  const weekParam = typeof params?.week === "string" ? params.week : undefined;
  const requested = (weekParam && parseDateOnly(weekParam)) || toDateOnly(new Date());
  const weekStart = startOfWeekMonday(requested);
  const weekEnd = addDays(weekStart, 7);
  const prevWeek = formatDateISO(addDays(weekStart, -7));
  const nextWeek = formatDateISO(addDays(weekStart, 7));
  const weekStartStr = formatDateISO(weekStart);

  const coachIdFilter = typeof params?.coachId === "string" ? params.coachId : "";
  const typeFilter = typeof params?.type === "string" ? params.type : "";

  const [instances, coaches, doneSubmissions] = await Promise.all([
    prisma.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
      include: { coach: true, template: { include: { coach: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { room: "asc" }],
    }),
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classSubmission.findMany({
      where: { classInstance: { date: { gte: weekStart, lt: weekEnd } }, status: "DONE" },
      include: { coach: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const instancesById = new Map(instances.map((i) => [i.id, i]));

  // Filters only narrow what's shown in the grid/missed-classes view —
  // conflict detection below still runs against the full unfiltered week so
  // a hidden coach's double-booking doesn't silently disappear.
  const filteredInstances = instances.filter((inst) => {
    if (coachIdFilter && inst.coachId !== coachIdFilter) return false;
    if (typeFilter === "private" && !inst.isPrivate) return false;
    if (typeFilter === "group" && inst.isPrivate) return false;
    return true;
  });

  const submissionsByInstance = new Map<string, typeof doneSubmissions>();
  for (const sub of doneSubmissions) {
    const list = submissionsByInstance.get(sub.classInstanceId) ?? [];
    list.push(sub);
    submissionsByInstance.set(sub.classInstanceId, list);
  }
  const conflicts: ConflictInstance[] = instances
    .filter((inst) => (submissionsByInstance.get(inst.id)?.length ?? 0) > 1)
    .map((inst) => ({
      id: inst.id,
      date: inst.date,
      startTime: inst.startTime,
      endTime: inst.endTime,
      label: inst.label,
      room: inst.room,
      officialCoachId: inst.substituteCoachId ?? inst.coachId,
      submissions: (submissionsByInstance.get(inst.id) ?? []).map((sub) => ({
        id: sub.id,
        coachId: sub.coachId,
        coachName: sub.coach.name,
      })),
    }));

  // Same coach reporting two (or more) classes whose times overlap — a
  // physical impossibility, so it's flagged for the admin instead of blocked
  // outright (a coach can always change their own status, per design).
  const doneByCoach = new Map<string, typeof doneSubmissions>();
  for (const sub of doneSubmissions) {
    const list = doneByCoach.get(sub.coachId) ?? [];
    list.push(sub);
    doneByCoach.set(sub.coachId, list);
  }
  const timeConflictGroups: TimeConflictGroup[] = [];
  for (const subs of doneByCoach.values()) {
    const overlappingIds = new Set<string>();
    for (let i = 0; i < subs.length; i++) {
      const instA = instancesById.get(subs[i].classInstanceId);
      if (!instA) continue;
      for (let j = i + 1; j < subs.length; j++) {
        const instB = instancesById.get(subs[j].classInstanceId);
        if (!instB) continue;
        if (
          formatDateISO(instA.date) === formatDateISO(instB.date) &&
          instA.startTime < instB.endTime &&
          instB.startTime < instA.endTime
        ) {
          overlappingIds.add(subs[i].id);
          overlappingIds.add(subs[j].id);
        }
      }
    }
    if (overlappingIds.size === 0) continue;
    const relevant = subs.filter((s) => overlappingIds.has(s.id));
    timeConflictGroups.push({
      coachName: relevant[0].coach.name,
      classes: relevant.map((s) => {
        const inst = instancesById.get(s.classInstanceId)!;
        return {
          submissionId: s.id,
          label: inst.label,
          room: inst.room,
          date: inst.date,
          startTime: inst.startTime,
          endTime: inst.endTime,
        };
      }),
    });
  }

  return (
    <div className="text-neutral-300">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Weekly Planning</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/planning?week=${prevWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            ← Prev
          </Link>
          <span className="text-neutral-500">
            {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
          </span>
          <Link
            href={`/admin/planning?week=${nextWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <form action={generateWeek}>
          <input type="hidden" name="weekStart" value={formatDateISO(weekStart)} />
          <button
            type="submit"
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Generate this week from templates
          </button>
        </form>
        <ResetWeekButton weekStart={formatDateISO(weekStart)} />
      </div>

      <ConflictsPanel instances={conflicts} />
      <TimeConflictsPanel groups={timeConflictGroups} />

      <PlanningFilters
        week={weekStartStr}
        coachId={coachIdFilter}
        type={typeFilter}
        coaches={coaches}
      />

      <WeekGrid
        weekStart={weekStart}
        instances={filteredInstances}
        headerAction={(inst) => (
          <form action={deleteClassInstance}>
            <input type="hidden" name="id" value={inst.id} />
            <button
              type="submit"
              className="shrink-0 text-[10px] text-neutral-500 opacity-0 hover:text-red-300 group-hover:opacity-100"
            >
              ✕
            </button>
          </form>
        )}
        control={(inst) => (
          <CoachSelect
            classInstanceId={inst.id}
            coachId={inst.coachId}
            coaches={coaches}
            templateCoachName={inst.template?.coach?.name ?? null}
          />
        )}
      />

      <MissedClassesPanel
        title="Missed classes — needs a substitute"
        instances={filteredInstances.filter((i) => i.status === "MISSED" && i.coachId)}
        coaches={coaches}
        showMissedBy
      />

      <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-white">
          Add a one-off class
        </h2>
        <form action={addAdHocClass} className="flex flex-col gap-2">
          <input
            type="date"
            name="date"
            required
            defaultValue={formatDateISO(weekStart)}
            min={formatDateISO(weekStart)}
            max={formatDateISO(addDays(weekStart, 6))}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="time"
              name="startTime"
              required
              className="w-1/2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            />
            <input
              type="time"
              name="endTime"
              required
              className="w-1/2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <select
            name="room"
            required
            defaultValue=""
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
          >
            <option value="" disabled>
              Room
            </option>
            {ROOMS.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="label"
            required
            placeholder="Label"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-sm text-neutral-300">
            <input type="checkbox" name="isPrivate" className="accent-white" />
            Private class
          </label>
          <button
            type="submit"
            className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Add class
          </button>
        </form>
      </div>
    </div>
  );
}
