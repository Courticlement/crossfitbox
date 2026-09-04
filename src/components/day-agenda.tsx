import type { ReactNode } from "react";
import Link from "next/link";
import { addDays, formatDateISO } from "@/lib/dates";
import { hexToRgba } from "@/lib/coach-colors";
import { statusLabel } from "@/lib/status-labels";
import { STATUS_BORDER, type WeekGridInstance, type WeekGridRoom } from "@/components/week-grid";

const DEFAULT_ROOM_COLOR = "#525252";

// getUTCDay(): 0 = Sunday ... 6 = Saturday.
const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

// The mobile counterpart to WeekGrid — a full 7-day×5-minute-slot calendar
// doesn't fit a phone screen, so this shows one day at a time instead, with
// the same per-class info (time, label, room, status) laid out as a
// full-width card instead of a tiny absolutely-positioned block. Reuses
// WeekGrid's own `headerAction`/`control` render props so admin and coach
// callers wire up identical actions on both views.
export function DayAgenda<T extends WeekGridInstance>({
  weekStart,
  selectedDay,
  dayHrefs,
  instances,
  rooms,
  headerAction,
  control,
  highlightInstanceId,
  unavailableInstanceIds,
  closedDates,
  emptyLabel = "Aucun cours ce jour-là.",
}: {
  weekStart: Date;
  // Which of the 7 days to show — resolved server-side by the caller (from
  // a `day` search param, defaulting to today or a highlighted instance's
  // date), since this stays a plain server component like WeekGrid.
  selectedDay: Date;
  // One href per day (ISO date -> URL), built by the caller so it can
  // preserve whatever other filters/params are already on the page.
  dayHrefs: Record<string, string>;
  instances: T[];
  rooms: WeekGridRoom[];
  headerAction?: (inst: T) => ReactNode;
  control?: (inst: T) => ReactNode;
  highlightInstanceId?: string | null;
  unavailableInstanceIds?: Set<string>;
  closedDates?: Set<string>;
  emptyLabel?: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const selectedISO = formatDateISO(selectedDay);
  const dayInstances = instances
    .filter((inst) => formatDateISO(inst.date) === selectedISO)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const closed = closedDates?.has(selectedISO) ?? false;

  return (
    <div className="mb-8 md:hidden">
      <div className="mb-3 flex gap-1.5">
        {days.map((day) => {
          const iso = formatDateISO(day);
          const isSelected = iso === selectedISO;
          return (
            <Link
              key={iso}
              href={dayHrefs[iso] ?? "#"}
              className={`flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-white text-neutral-950"
                  : "bg-neutral-900 text-neutral-400 hover:text-white"
              }`}
            >
              <span className="block">{DAY_LETTERS[day.getUTCDay()]}</span>
              <span className="block text-[10px] opacity-70">{day.getUTCDate()}</span>
            </Link>
          );
        })}
      </div>

      {closed && (
        <p className="mb-3 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Box fermée ce jour-là.
        </p>
      )}

      {dayInstances.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 py-8 text-center text-sm text-neutral-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {dayInstances.map((inst) => {
            const room = roomById.get(inst.roomId);
            const isHighlighted = highlightInstanceId != null && inst.id === highlightInstanceId;
            const coachUnavailable = unavailableInstanceIds?.has(inst.id) ?? false;
            // Same "still needs a coach" definition as WeekGrid — still
            // PLANNED, nobody assigned, and not a team event (which has no
            // coachId by design, not an actual gap).
            const needsCoach = !inst.coachId && inst.status === "PLANNED" && !inst.isTeamEvent;
            // Same coach-color tint as WeekGrid, so a coach's classes read
            // the same way whether the head coach is looking at the full
            // week grid or this one-day mobile view — the status color
            // still carries the outcome via the left border regardless.
            const coachBg = !coachUnavailable && inst.coachColor ? hexToRgba(inst.coachColor, 0.35) : null;
            // Same overrides as WeekGrid — a team event or a still-unassigned
            // class each drown out every other border/background rule
            // (coach color included), amber for the former, red for the
            // latter.
            const border = inst.isTeamEvent
              ? "border-2 border-amber-400"
              : needsCoach
                ? "border-2 border-red-400"
                : `border-l-4 border-neutral-800 ${STATUS_BORDER[inst.status] ?? "border-l-neutral-600"}`;
            return (
              <div
                key={inst.id}
                // "-mobile" suffix keeps this id distinct from WeekGrid's
                // own `class-instance-${id}` for the same instance — both
                // are always in the DOM (CSS toggles which one shows), so
                // sharing an id would be invalid HTML. See ScrollToHighlight,
                // which tries both.
                id={isHighlighted ? `class-instance-mobile-${inst.id}` : undefined}
                className={`rounded-lg p-3 ${border} ${
                  inst.isTeamEvent
                    ? "bg-gradient-to-br from-amber-500/25 via-amber-600/10 to-neutral-900"
                    : needsCoach
                      ? "bg-gradient-to-br from-red-500/25 via-red-600/10 to-neutral-900"
                      : coachUnavailable
                        ? "bg-red-950/60"
                        : coachBg
                          ? ""
                          : "bg-neutral-900"
                } ${isHighlighted ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-950" : ""} ${
                  coachUnavailable ? "ring-2 ring-red-500" : ""
                }`}
                style={!inst.isTeamEvent && coachBg ? { backgroundColor: coachBg } : undefined}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-white">
                      {inst.startTime}–{inst.endTime}
                    </span>
                    {/* Room badge — colored to match this room's own
                        WeekGrid lane tint, so "which room" reads at a
                        glance here too instead of being buried in the small
                        gray meta line below the label. */}
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: hexToRgba(room?.color ?? DEFAULT_ROOM_COLOR, 0.2) ?? undefined,
                        color: room?.color ?? DEFAULT_ROOM_COLOR,
                      }}
                    >
                      {room?.name ?? ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {inst.isTeamEvent && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                        🎉 Équipe
                      </span>
                    )}
                    {needsCoach && (
                      <span className="rounded-full bg-red-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-950">
                        Non assigné
                      </span>
                    )}
                    {isHighlighted && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Prochain
                      </span>
                    )}
                    {coachUnavailable && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                        Indisponible
                      </span>
                    )}
                    {inst.isPrivate && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                        Privé
                      </span>
                    )}
                    {headerAction?.(inst)}
                  </div>
                </div>
                <div
                  className={`mb-1 text-[15px] font-semibold ${
                    inst.isTeamEvent ? "text-amber-100" : needsCoach ? "text-red-100" : "text-white"
                  }`}
                >
                  {inst.label}
                </div>
                <div className="mb-2 text-xs text-neutral-500">{statusLabel(inst.status)}</div>
                {control?.(inst)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
