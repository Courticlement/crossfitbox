import type { ReactNode } from "react";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { timeToMinutes, formatHourLabel, layoutDayEventsToGrid } from "@/lib/calendar-layout";
import { hexToRgba } from "@/lib/coach-colors";

const SLOT_MINUTES = 5;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const ROW_PX = 11; // SLOTS_PER_HOUR * ROW_PX = 132px per hour — a MISSED
// class can grow a 4th row (the substitute picker) on top of time/label/
// coach, so this needs more headroom than a plain class does; see the
// overflow-hidden event block below.
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const GUTTER_COL = "64px";
const DAY_COL = "minmax(150px, 1fr)";

const STATUS_BORDER: Record<string, string> = {
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
  "Room 1": "bg-sky-950/60",
  "Room 2": "bg-violet-950/60",
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
  highlightCoachId,
  unavailableInstanceIds,
  closedDates,
}: {
  weekStart: Date;
  instances: T[];
  headerAction?: (inst: T) => ReactNode;
  control: (inst: T) => ReactNode;
  // When set, the selected coach's own group classes get a bright ring and
  // everyone else's classes fade back — makes "which of these are mine"
  // answerable at a glance instead of reading each block's assignment.
  // Private classes aren't dimmed either way (they're already unambiguous —
  // a coach's own private classes only ever show up on their own page).
  highlightCoachId?: string | null;
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
    <div className="mb-8 overflow-x-auto rounded-lg border border-neutral-800">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${GUTTER_COL} repeat(7, ${DAY_COL})`,
          gridTemplateRows: `auto repeat(${totalRows}, ${ROW_PX}px)`,
          minWidth: 64 + 7 * 130,
        }}
      >
        {/* Header row */}
        <div
          className="border-b border-neutral-800 bg-neutral-900"
          style={{ gridColumn: 1, gridRow: 1 }}
        />
        {days.map((day, dayIdx) => {
          const closed = closedDates?.has(formatDateISO(day)) ?? false;
          return (
            <div
              key={formatDateISO(day)}
              className={`flex items-center justify-between gap-1 border-b border-l border-neutral-800 p-2 text-xs font-medium ${closed ? "bg-red-950/40 text-red-300" : "bg-neutral-900 text-white"}`}
              style={{ gridColumn: dayIdx + 2, gridRow: 1 }}
            >
              <span>{formatDayLabel(day)}</span>
              {closed && (
                <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide text-red-300">
                  Closed
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
            const needsCoach = !inst.coachId && inst.status === "PLANNED";
            const isMine = highlightCoachId != null && inst.coachId === highlightCoachId;
            const isMineGroup = isMine && !inst.isPrivate;
            const faded = highlightCoachId != null && !isMine;
            const coachUnavailable = unavailableInstanceIds?.has(inst.id) ?? false;
            const statusBg = STATUS_BG[inst.status];
            // Falls back to the room tint (as a class) whenever there's no
            // per-coach color to use — no coach assigned, the coach hasn't
            // set one, or this grid doesn't fetch coachColor at all.
            const coachBg = !coachUnavailable && !statusBg && inst.coachColor
              ? hexToRgba(inst.coachColor, 0.35)
              : null;
            const bg = coachUnavailable
              ? "bg-red-950/60"
              : (statusBg ?? (coachBg ? "" : (ROOM_BG[inst.room] ?? "bg-neutral-900")));
            return (
              <div
                key={inst.id}
                title={`${inst.label} · ${inst.room} · ${inst.startTime}–${inst.endTime} · ${inst.status}${coachUnavailable ? " · assigned coach is unavailable" : ""}`}
                className={`group relative z-10 flex flex-col gap-1 overflow-hidden rounded-md border-l-4 p-1.5 transition-opacity ${STATUS_BORDER[inst.status] ?? "border-l-neutral-600"} ${bg} ${needsCoach ? "ring-1 ring-inset ring-amber-600/60" : ""} ${coachUnavailable ? "ring-2 ring-inset ring-red-500" : ""} ${isMineGroup ? "ring-2 ring-inset ring-white/80" : ""} ${faded ? "opacity-40" : ""}`}
                style={{
                  gridColumn: dayIdx + 2,
                  gridRow: `${1 + rowStart} / ${1 + rowEnd}`,
                  justifySelf: "start",
                  marginLeft: `${left}%`,
                  width: `calc(${width}% - 2px)`,
                  ...(coachBg ? { backgroundColor: coachBg } : {}),
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-mono text-[10px] font-semibold text-neutral-300">
                    {inst.startTime}–{inst.endTime}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {coachUnavailable && (
                      <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide text-red-300">
                        Unavailable
                      </span>
                    )}
                    {inst.isPrivate && (
                      <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide text-violet-300">
                        Private
                      </span>
                    )}
                    {headerAction?.(inst)}
                  </div>
                </div>
                <div className="line-clamp-2 text-[12px] font-semibold leading-tight text-white">
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
