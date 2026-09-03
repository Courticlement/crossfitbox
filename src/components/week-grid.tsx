import type { ReactNode } from "react";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { timeToMinutes, formatHourLabel, layoutDayEventsToGrid } from "@/lib/calendar-layout";
import { hexToRgba } from "@/lib/coach-colors";
import { statusLabel } from "@/lib/status-labels";

const SLOT_MINUTES = 5;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const ROW_PX = 8; // SLOTS_PER_HOUR * ROW_PX = 96px per hour — kept as
// compact as still comfortably fits a MISSED class's 4th row (the
// substitute picker) on top of time/label/coach; see the overflow-hidden
// event block below. Shrinking further starts clipping that case.
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const GUTTER_COL = "64px";
const DAY_COL = "minmax(150px, 1fr)";

export const STATUS_BORDER: Record<string, string> = {
  PLANNED: "border-l-neutral-600",
  DONE: "border-l-emerald-500",
  MISSED: "border-l-red-500",
  CANCELLED: "border-l-neutral-700",
};

// DONE/MISSED get a strong status-colored background so the outcome reads
// at a glance — that matters more once a class is resolved than who's
// teaching it. Still-PLANNED (and CANCELLED) classes are tinted by the
// assigned coach's color instead (see coachColor below), falling back to
// the room's color when the coach has none set or none is assigned yet.
const STATUS_BG: Record<string, string> = {
  DONE: "bg-emerald-950/50",
  MISSED: "bg-red-950/50",
  CANCELLED: "bg-neutral-900/40",
};

const ROOM_BG: Record<string, string> = {
  "Salle 1": "bg-sky-950/60",
  "Salle 2": "bg-violet-950/60",
};

export type WeekGridInstance = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
  room: string;
  status: string;
  isPrivate: boolean;
  // A whole-team event (see ClassInstance.isTeamEvent) — rendered with a
  // much louder treatment than any other class, on both this grid and
  // DayAgenda, since it needs every coach to notice it regardless of
  // whether it's "theirs".
  isTeamEvent?: boolean;
  coachId: string | null;
  // The assigned coach's Coach.color, if they have one set — tints
  // still-PLANNED/CANCELLED classes on the admin Planning grid so the head
  // coach can see who's teaching what at a glance. Undefined (not just
  // null) on grids that don't fetch it (e.g. a coach's own My Classes page),
  // which falls back to the existing room tint exactly as before.
  coachColor?: string | null;
};

export function WeekGrid<T extends WeekGridInstance>({
  weekStart,
  instances,
  headerAction,
  control,
  selectionAction,
  highlightCoachId,
  highlightInstanceId,
  unavailableInstanceIds,
  closedDates,
}: {
  weekStart: Date;
  instances: T[];
  headerAction?: (inst: T) => ReactNode;
  control: (inst: T) => ReactNode;
  // Rendered at the very start of each block's header row (before the time
  // label) — used by the admin Planning page to drop in a selection
  // checkbox for bulk coach reassignment. Left undefined anywhere else
  // (e.g. a coach's own My Classes grid), so nothing renders there.
  selectionAction?: (inst: T) => ReactNode;
  // When set, the selected coach's own group classes get a bright ring and
  // everyone else's classes fade back — makes "which of these are mine"
  // answerable at a glance instead of reading each block's assignment.
  // Private classes aren't dimmed either way (they're already unambiguous —
  // a coach's own private classes only ever show up on their own page).
  highlightCoachId?: string | null;
  // One specific instance to call out — e.g. the Dashboard's "no review yet"
  // link into a coach's next class. Gets a bright ring plus a small badge,
  // and the page auto-scrolls to it (see the Planning page's highlight
  // param) since the target class can land anywhere in the grid.
  highlightInstanceId?: string | null;
  // Instance ids whose currently-assigned coach flagged themselves
  // unavailable that day (see admin/planning's unavailableInstanceIds) —
  // turns the block red so the admin spots it needs a different coach.
  unavailableInstanceIds?: Set<string>;
  // ISO date strings ("YYYY-MM-DD") the box is closed that week (see
  // admin/planning's BoxClosuresCard) — tints the whole day column and
  // labels its header, independent of whatever classes still sit on it.
  closedDates?: Set<string>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allMinutes = instances.flatMap((i) => [
    timeToMinutes(i.startTime),
    timeToMinutes(i.endTime),
  ]);
  const rangeStartHour = Math.min(
    DEFAULT_START_HOUR,
    allMinutes.length ? Math.floor(Math.min(...allMinutes) / 60) : DEFAULT_START_HOUR
  );
  const rangeEndHour = Math.max(
    DEFAULT_END_HOUR,
    allMinutes.length ? Math.ceil(Math.max(...allMinutes) / 60) : DEFAULT_END_HOUR
  );
  const hours = Array.from(
    { length: rangeEndHour - rangeStartHour },
    (_, i) => rangeStartHour + i
  );
  const totalRows = hours.length * SLOTS_PER_HOUR;
  const rangeStartMinutes = rangeStartHour * 60;

  return (
    // Bounding this to the viewport (max-h) and scrolling internally
    // (overflow-auto on both axes) is what makes the sticky day header below
    // actually stick: a plain overflow-x-auto wrapper already becomes a
    // scroll container on the y-axis too (browsers force overflow-y to
    // "auto" the moment overflow-x isn't "visible"), but without a height
    // constraint it never scrolls internally — so instead of sticking, its
    // position:sticky children silently just track the page's scroll and
    // scroll away with everything else.
    <div className="mb-8 max-h-[75vh] overflow-auto rounded-lg border border-neutral-800">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${GUTTER_COL} repeat(7, ${DAY_COL})`,
          gridTemplateRows: `auto repeat(${totalRows}, ${ROW_PX}px)`,
          minWidth: 64 + 7 * 130,
        }}
      >
        {/* Header row — sticky so the day/date labels stay visible while
            scrolling down through the hour grid below (the page itself
            scrolls; nothing above this sticks, so top-0 pins it right under
            the viewport's edge). z-20 keeps it above the event blocks
            (z-10), which would otherwise scroll up underneath it. */}
        <div
          className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900"
          style={{ gridColumn: 1, gridRow: 1 }}
        />
        {days.map((day, dayIdx) => {
          const closed = closedDates?.has(formatDateISO(day)) ?? false;
          return (
            <div
              key={formatDateISO(day)}
              className={`sticky top-0 z-20 flex items-center justify-between gap-1 border-b border-l border-neutral-800 p-2 text-xs font-medium ${closed ? "bg-red-950/40 text-red-300" : "bg-neutral-900 text-white"}`}
              style={{ gridColumn: dayIdx + 2, gridRow: 1 }}
            >
              <span>{formatDayLabel(day)}</span>
              {closed && (
                <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide text-red-300">
                  Fermé
                </span>
              )}
            </div>
          );
        })}

        {/* Hour labels + background hour cells (grid + separators) */}
        {hours.map((hour, hourIdx) => {
          const rowStart = 2 + hourIdx * SLOTS_PER_HOUR;
          const rowEnd = rowStart + SLOTS_PER_HOUR;
          return (
            <div key={`label-${hour}`} className="contents">
              <div
                className="relative border-t border-neutral-800"
                style={{ gridColumn: 1, gridRow: `${rowStart} / ${rowEnd}` }}
              >
                <span className="absolute -top-2 right-2 text-[10px] text-neutral-500">
                  {formatHourLabel(hour)}
                </span>
              </div>
              {days.map((day, dayIdx) => (
                <div
                  key={`${formatDateISO(day)}-${hour}`}
                  className={`border-t border-l border-neutral-800 ${closedDates?.has(formatDateISO(day)) ? "bg-red-950/10" : ""}`}
                  style={{ gridColumn: dayIdx + 2, gridRow: `${rowStart} / ${rowEnd}` }}
                />
              ))}
            </div>
          );
        })}

        {/* Events */}
        {days.map((day, dayIdx) => {
          const dayInstances = instances.filter(
            (inst) => formatDateISO(inst.date) === formatDateISO(day)
          );
          const positioned = layoutDayEventsToGrid(
            dayInstances,
            rangeStartMinutes,
            SLOT_MINUTES
          );

          return positioned.map(({ item: inst, rowStart, rowEnd, left, width }) => {
            const needsCoach = !inst.coachId && inst.status === "PLANNED" && !inst.isTeamEvent;
            const isHighlighted = highlightInstanceId != null && inst.id === highlightInstanceId;
            const isMine = highlightCoachId != null && inst.coachId === highlightCoachId;
            const isMineGroup = isMine && !inst.isPrivate;
            // A team event has no coachId (see ClassInstance.isTeamEvent) but
            // is everyone's — the "dim what isn't mine" treatment that helps
            // a coach find their own classes shouldn't wash out the one
            // block every coach actually needs to notice.
            const faded = highlightCoachId != null && !isMine && !inst.isTeamEvent;
            const coachUnavailable = unavailableInstanceIds?.has(inst.id) ?? false;
            const statusBg = STATUS_BG[inst.status];
            // The coach's color now always wins the background, DONE/MISSED
            // included, so a class visually stays "theirs" no matter its
            // outcome — the outcome itself still reads from the border-left
            // color (STATUS_BORDER) and the status-labeled title tooltip.
            // Falls back to the status tint, then the room tint, whenever
            // there's no per-coach color to use — no coach assigned, the
            // coach hasn't set one, or this grid doesn't fetch coachColor.
            const coachBg = !coachUnavailable && inst.coachColor
              ? hexToRgba(inst.coachColor, 0.35)
              : null;
            const bg = coachUnavailable
              ? "bg-red-950/60"
              : (coachBg ? "" : (statusBg ?? (ROOM_BG[inst.room] ?? "bg-neutral-900")));
            // A team event overrides every other border/background rule —
            // it has no coach and no status story to tell, just "everyone
            // needs to see this" (see ClassInstance.isTeamEvent). A still-
            // unassigned class gets the same loud treatment (in red instead
            // of amber) since it's the other case that needs the admin's
            // attention before the week is ready.
            const border = inst.isTeamEvent
              ? "border-2 border-amber-400"
              : needsCoach
                ? "border-2 border-red-400"
                : `border-l-4 ${STATUS_BORDER[inst.status] ?? "border-l-neutral-600"}`;
            return (
              <div
                key={inst.id}
                id={isHighlighted ? `class-instance-${inst.id}` : undefined}
                title={`${inst.isTeamEvent ? "Événement d'équipe · " : ""}${inst.label} · ${inst.room} · ${inst.startTime}–${inst.endTime} · ${statusLabel(inst.status)}${coachUnavailable ? " · le coach assigné est indisponible" : ""}`}
                className={`group relative z-10 flex flex-col gap-1 overflow-hidden rounded-md p-1.5 transition-opacity ${border} ${inst.isTeamEvent ? "bg-gradient-to-br from-amber-500/30 via-amber-600/15 to-neutral-900" : needsCoach ? "bg-gradient-to-br from-red-500/30 via-red-600/15 to-neutral-900" : bg} ${coachUnavailable ? "ring-2 ring-inset ring-red-500" : ""} ${isMineGroup ? "ring-2 ring-inset ring-white/80" : ""} ${isHighlighted ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-950" : ""} ${faded ? "opacity-40" : ""}`}
                style={{
                  gridColumn: dayIdx + 2,
                  gridRow: `${1 + rowStart} / ${1 + rowEnd}`,
                  justifySelf: "start",
                  marginLeft: `${left}%`,
                  width: `calc(${width}% - 2px)`,
                  ...(!inst.isTeamEvent && coachBg ? { backgroundColor: coachBg } : {}),
                }}
              >
                <div className="flex items-center gap-1">
                  <div className="flex min-w-0 shrink items-center gap-1">
                    {selectionAction?.(inst)}
                    <span className="truncate font-mono text-[10px] font-semibold text-neutral-300">
                      {inst.startTime}–{inst.endTime}
                    </span>
                  </div>
                  {/* Badges shrink and clip first — headerAction (review/delete)
                      sits in its own shrink-0 group pinned to the right edge
                      (ml-auto) so it never gets pushed past the block's edge
                      and silently clipped by overflow-hidden, which happened
                      on narrow side-by-side blocks (e.g. two classes at the
                      same time) once the team-event badge alone was wider
                      than the column. */}
                  <div className="flex min-w-0 shrink items-center gap-1 overflow-hidden">
                    {inst.isTeamEvent && (
                      <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wide text-amber-950">
                        🎉 Équipe
                      </span>
                    )}
                    {needsCoach && (
                      <span className="shrink-0 rounded-full bg-red-400 px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wide text-red-950">
                        Non assigné
                      </span>
                    )}
                    {isHighlighted && (
                      <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide text-amber-300">
                        Prochain
                      </span>
                    )}
                    {coachUnavailable && (
                      <span className="shrink-0 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide text-red-300">
                        Indisponible
                      </span>
                    )}
                    {inst.isPrivate && (
                      <span className="shrink-0 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide text-violet-300">
                        Privé
                      </span>
                    )}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">{headerAction?.(inst)}</div>
                </div>
                <div
                  className={`line-clamp-2 text-[12px] font-semibold leading-tight ${
                    inst.isTeamEvent ? "text-amber-100" : needsCoach ? "text-red-100" : "text-white"
                  }`}
                >
                  {inst.label}
                </div>
                <div className="mt-auto">{control(inst)}</div>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
