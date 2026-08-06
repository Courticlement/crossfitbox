import type { ReactNode } from "react";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { timeToMinutes, formatHourLabel, layoutDayEventsToGrid } from "@/lib/calendar-layout";

const SLOT_MINUTES = 5;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const ROW_PX = 8; // SLOTS_PER_HOUR * ROW_PX = 96px per hour — tall enough that
// a 30-min class still has room to show its time, label, and coach without
// clipping (see the overflow-hidden event block below).
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
};

export function WeekGrid<T extends WeekGridInstance>({
  weekStart,
  instances,
  headerAction,
  control,
}: {
  weekStart: Date;
  instances: T[];
  headerAction?: (inst: T) => ReactNode;
  control: (inst: T) => ReactNode;
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
        {days.map((day, dayIdx) => (
          <div
            key={formatDateISO(day)}
            className="border-b border-l border-neutral-800 bg-neutral-900 p-2 text-xs font-medium text-white"
            style={{ gridColumn: dayIdx + 2, gridRow: 1 }}
          >
            {formatDayLabel(day)}
          </div>
        ))}

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
                  className="border-t border-l border-neutral-800"
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
            return (
              <div
                key={inst.id}
                title={`${inst.label} · ${inst.room} · ${inst.startTime}–${inst.endTime} · ${inst.status}`}
                className={`group relative z-10 flex flex-col gap-1 overflow-hidden rounded-md border-l-4 p-1.5 ${STATUS_BORDER[inst.status] ?? "border-l-neutral-600"} ${ROOM_BG[inst.room] ?? "bg-neutral-900"} ${needsCoach ? "ring-1 ring-inset ring-amber-600/60" : ""}`}
                style={{
                  gridColumn: dayIdx + 2,
                  gridRow: `${1 + rowStart} / ${1 + rowEnd}`,
                  justifySelf: "start",
                  marginLeft: `${left}%`,
                  width: `calc(${width}% - 2px)`,
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-mono text-[10px] font-semibold text-neutral-300">
                    {inst.startTime}–{inst.endTime}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
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
