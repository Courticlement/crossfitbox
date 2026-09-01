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
import { AddAdHocClassForm } from "@/components/add-adhoc-class-form";
import { BoxClosuresCard } from "@/components/box-closures-card";
import { BulkAssignProvider, SelectClassCheckbox } from "@/components/bulk-coach-assign";
import { CoachSelect } from "@/components/coach-select";
import { ConflictsPanel, type ConflictInstance } from "@/components/conflicts-panel";
import { DayAgenda } from "@/components/day-agenda";
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
import { generateWeek, validateWeek, unlockWeek } from "@/lib/actions/planning";

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

  // Which single day the mobile agenda (DayAgenda) shows — the full week
  // grid works fine on mobile as read-only-ish scroll, but picking one
  // class to act on inside it doesn't, so mobile gets a day-at-a-time view
  // instead. Prefers an explicit ?day=, then the highlighted instance's own
  // day (see highlightInstanceId above), then today, all clamped to this
  // week.
  const dayParam = typeof params?.day === "string" ? params.day : undefined;
  const today = toDateOnly(new Date());
  let selectedDay = weekStart;
  const dayCandidate =
    (dayParam && parseDateOnly(dayParam)) ||
    (highlightInstanceId ? instancesById.get(highlightInstanceId)?.date : undefined) ||
    today;
  if (dayCandidate >= weekStart && dayCandidate < weekEnd) selectedDay = dayCandidate;

  const dayHrefs: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const iso = formatDateISO(addDays(weekStart, i));
    const sp = new URLSearchParams();
    sp.set("week", weekStartStr);
    if (coachIdFilter) sp.set("coachId", coachIdFilter);
    if (typeFilter) sp.set("type", typeFilter);
    if (roomFilter) sp.set("room", roomFilter);
    sp.set("day", iso);
    dayHrefs[iso] = `/admin/planning?${sp.toString()}`;
  }

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
      // A team event has no coachId by design (see ClassInstance.isTeamEvent)
      // but involves every coach — filtering Planning down to one coach
      // shouldn't hide it, the same way it wouldn't hide a class that
      // coach is actually assigned to.
      if (coachIdFilter && inst.coachId !== coachIdFilter && !inst.isTeamEvent) return false;
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

  // Shared by WeekGrid (desktop) and DayAgenda (mobile) below, so admin
  // actions — assign, review, delete, substitute — stay identical on both.
  const renderHeaderAction = (inst: (typeof filteredInstances)[number]) => (
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
  );
  // A team event has no single coach to assign (see ClassInstance.isTeamEvent)
  // — showing the assign dropdown would just invite picking one, which
  // contradicts the whole point of the event.
  const renderControl = (inst: (typeof filteredInstances)[number]) =>
    inst.isTeamEvent ? null : (
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
    );

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

      <div className="hidden md:block">
        <BulkAssignProvider coaches={coaches}>
          <WeekGrid
            weekStart={weekStart}
            instances={filteredInstances}
            highlightInstanceId={highlightInstanceId}
            unavailableInstanceIds={unavailableInstanceIds}
            closedDates={closedDates}
            selectionAction={(inst) => <SelectClassCheckbox id={inst.id} />}
            headerAction={renderHeaderAction}
            control={renderControl}
          />
        </BulkAssignProvider>
      </div>
      <DayAgenda
        weekStart={weekStart}
        selectedDay={selectedDay}
        dayHrefs={dayHrefs}
        instances={filteredInstances}
        highlightInstanceId={highlightInstanceId}
        unavailableInstanceIds={unavailableInstanceIds}
        closedDates={closedDates}
        headerAction={renderHeaderAction}
        control={renderControl}
      />

      <div className="flex flex-wrap gap-4">
        <BoxClosuresCard entries={upcomingClosures} />
        <AddAdHocClassForm weekStart={weekStart} coaches={coaches} />
      </div>
    </div>
  );
}
