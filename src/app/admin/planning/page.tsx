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
import { BoxClosuresCard } from "@/components/box-closures-card";
import { BulkAssignProvider, SelectClassCheckbox } from "@/components/bulk-coach-assign";
import { CoachSelect } from "@/components/coach-select";
import { ConflictsPanel, type ConflictInstance } from "@/components/conflicts-panel";
import { DeleteClassButton } from "@/components/delete-class-button";
import { PlanningFilters } from "@/components/planning-filters";
import { ReviewButton } from "@/components/review-button";
import { PrevWeekBanner } from "@/components/prev-week-banner";
import { ScrollToHighlight } from "@/components/scroll-to-highlight";
import { UnavailabilityAlert } from "@/components/unavailability-alert";
import { ResetWeekButton } from "@/components/reset-week-button";
import { SubstituteSelect } from "@/components/substitute-select";
import { TimeConflictsPanel, type TimeConflictGroup } from "@/components/time-conflicts-panel";
import { WeekGrid } from "@/components/week-grid";
import { ROOMS } from "@/lib/rooms";
import { generateWeek, addAdHocClass, validateWeek, unlockWeek } from "@/lib/actions/planning";

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
  const roomFilter = typeof params?.room === "string" ? params.room : "";
  // Set by the Dashboard's "no review yet" link into a coach's next class
  // (see WeekDashboard/MonthDashboard) — rings that one block and scrolls
  // to it, since it can land anywhere in the week.
  const highlightInstanceId = typeof params?.highlight === "string" ? params.highlight : undefined;

  const [instances, coaches, doneSubmissions, planningWeek, unavailabilities, weekClosures, upcomingClosures] =
    await Promise.all([
      prisma.classInstance.findMany({
        where: { date: { gte: weekStart, lt: weekEnd } },
        include: { coach: true, template: { include: { coach: true } }, review: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }, { room: "asc" }],
      }),
      prisma.coach.findMany({ orderBy: { name: "asc" } }),
      prisma.classSubmission.findMany({
        where: { classInstance: { date: { gte: weekStart, lt: weekEnd } }, status: "DONE" },
        include: { coach: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.planningWeek.findUnique({ where: { weekStart } }),
      prisma.unavailability.findMany({
        where: {
          OR: [
            { recurring: true, startDate: { lt: weekEnd } },
            { recurring: false, startDate: { lt: weekEnd }, endDate: { gte: weekStart } },
          ],
        },
        select: { coachId: true, startDate: true, endDate: true, recurring: true },
      }),
      prisma.boxClosure.findMany({
        where: { date: { gte: weekStart, lt: weekEnd } },
        select: { date: true },
      }),
      prisma.boxClosure.findMany({
        where: { date: { gte: toDateOnly(new Date()) } },
        orderBy: { date: "asc" },
      }),
    ]);
  const validated = planningWeek !== null;
  const closedDates = new Set(weekClosures.map((c) => formatDateISO(c.date)));

  const instancesById = new Map(instances.map((i) => [i.id, i]));

  // Flags any still-open class (PLANNED, or MISSED with a substitute lined
  // up) whose currently-assigned coach flagged that exact day as
  // unavailable — WeekGrid turns these red so the admin knows to find
  // someone else instead of discovering it after the fact.
  const unavailableInstanceIds = new Set<string>();
  for (const inst of instances) {
    const relevantCoachId =
      inst.status === "PLANNED" ? inst.coachId : inst.status === "MISSED" ? inst.substituteCoachId : null;
    if (!relevantCoachId) continue;
    const isUnavailable = unavailabilities.some((u) => {
      if (u.coachId !== relevantCoachId) return false;
      if (u.recurring) return u.startDate <= inst.date && u.startDate.getUTCDay() === inst.date.getUTCDay();
      return u.startDate <= inst.date && inst.date <= u.endDate;
    });
    if (isUnavailable) unavailableInstanceIds.add(inst.id);
  }

  // Filters only narrow what's shown in the grid/missed-classes view —
  // conflict detection below still runs against the full unfiltered week so
  // a hidden coach's double-booking doesn't silently disappear.
  const filteredInstances = instances
    .filter((inst) => {
      if (coachIdFilter && inst.coachId !== coachIdFilter) return false;
      if (typeFilter === "private" && !inst.isPrivate) return false;
      if (typeFilter === "group" && inst.isPrivate) return false;
      if (roomFilter && inst.room !== roomFilter) return false;
      return true;
    })
    .map((inst) => ({ ...inst, coachColor: inst.coach?.color ?? null }));

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
        <h1 className="text-lg font-semibold text-white">Planning hebdomadaire</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/planning?week=${prevWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            ← Préc.
          </Link>
          <span className="text-neutral-500">
            {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
          </span>
          <Link
            href={`/admin/planning?week=${nextWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            Suivant →
          </Link>
        </div>
      </div>

      <PrevWeekBanner />
      <UnavailabilityAlert />

      <div className="mb-6 flex items-center gap-3">
        <form action={generateWeek}>
          <input type="hidden" name="weekStart" value={formatDateISO(weekStart)} />
          <button
            type="submit"
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Générer cette semaine depuis les modèles
          </button>
        </form>
        <ResetWeekButton weekStart={formatDateISO(weekStart)} />
        <div className="ml-auto flex items-center gap-2">
          {validated ? (
            <>
              <span className="rounded-full bg-emerald-900/40 px-2.5 py-1 text-xs text-emerald-300">
                Validée le {planningWeek.validatedAt.toLocaleString("fr-FR", { timeZone: "UTC" })}
              </span>
              <form action={unlockWeek}>
                <input type="hidden" name="weekStart" value={formatDateISO(weekStart)} />
                <button
                  type="submit"
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
                >
                  Déverrouiller
                </button>
              </form>
            </>
          ) : (
            <form action={validateWeek}>
              <input type="hidden" name="weekStart" value={formatDateISO(weekStart)} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Valider le planning
              </button>
            </form>
          )}
        </div>
      </div>
      {validated && (
        <p className="mb-4 text-xs text-neutral-500">
          Cette semaine est verrouillée — les coachs ne peuvent pas soumettre ni modifier leurs
          déclarations sur Mes cours tant que vous ne la déverrouillez pas.
        </p>
      )}

      <ConflictsPanel instances={conflicts} />
      <TimeConflictsPanel groups={timeConflictGroups} />

      <PlanningFilters
        week={weekStartStr}
        coachId={coachIdFilter}
        type={typeFilter}
        room={roomFilter}
        coaches={coaches}
      />

      {coaches.some((c) => c.color) && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
          {coaches
            .filter((c) => c.color)
            .map((c) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: c.color! }}
                  className="h-2.5 w-2.5 rounded-full"
                />
                {c.name}
              </span>
            ))}
        </div>
      )}

      {highlightInstanceId && <ScrollToHighlight instanceId={highlightInstanceId} />}

      <BulkAssignProvider coaches={coaches}>
        <WeekGrid
          weekStart={weekStart}
          instances={filteredInstances}
          highlightInstanceId={highlightInstanceId}
          unavailableInstanceIds={unavailableInstanceIds}
          closedDates={closedDates}
          selectionAction={(inst) => <SelectClassCheckbox id={inst.id} />}
          headerAction={(inst) => (
            <div className="flex items-center gap-1">
              <ReviewButton
                classInstanceId={inst.id}
                review={inst.review ? { id: inst.review.id, pastille: inst.review.pastille } : null}
                weekParam={weekStartStr}
              />
              <DeleteClassButton
                id={inst.id}
                reported={inst.status === "DONE" || inst.status === "MISSED"}
              />
            </div>
          )}
          control={(inst) => (
            <div className="flex flex-col gap-0.5">
              <CoachSelect
                classInstanceId={inst.id}
                coachId={inst.coachId}
                coaches={coaches}
                templateCoachName={inst.template?.coach?.name ?? null}
              />
              {inst.status === "MISSED" && (
                <SubstituteSelect
                  classInstanceId={inst.id}
                  coachId={inst.coachId}
                  substituteCoachId={inst.substituteCoachId}
                  coaches={coaches}
                  adminContext
                />
              )}
            </div>
          )}
        />
      </BulkAssignProvider>

      <div className="flex flex-wrap gap-4">
        <BoxClosuresCard entries={upcomingClosures} />
        <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-medium text-white">
            Ajouter un cours ponctuel
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
                Salle
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
              placeholder="Intitulé"
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
            <label className="flex items-center gap-1.5 text-sm text-neutral-300">
              <input type="checkbox" name="isPrivate" className="accent-white" />
              Cours privé
            </label>
            <select
              name="coachId"
              defaultValue=""
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              <option value="">Coach — à assigner plus tard</option>
              {coaches
                .filter((c) => !c.archived)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
            >
              Ajouter le cours
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
