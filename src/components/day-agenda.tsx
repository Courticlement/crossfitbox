import type { ReactNode } from "react";
import Link from "next/link";
import { addDays, formatDateISO } from "@/lib/dates";
import { hexToRgba } from "@/lib/coach-colors";
import { statusLabel } from "@/lib/status-labels";
import { STATUS_BORDER, STATUS_BORDER_LIGHT, type WeekGridInstance, type WeekGridRoom } from "@/components/week-grid";
import { ReviewDot } from "@/components/review-button";

const DEFAULT_ROOM_COLOR = "#525252";

// getUTCDay(): 0 = Sunday ... 6 = Saturday.
const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

// Same dark/light split as WeekGrid's buildTheme (see its own comment) —
// kept separate rather than shared since this card layout (full-width,
// badges inline in a flex row) differs enough from WeekGrid's tiny
// absolutely-positioned blocks that the two never reused the same JSX.
function buildTheme(light: boolean) {
  if (!light) {
    return {
      pillBg: "bg-neutral-900",
      pillText: "text-neutral-400",
      closedBorder: "border-red-900",
      closedBg: "bg-red-950/40",
      closedText: "text-red-300",
      emptyBorder: "border-neutral-800",
      emptyText: "text-neutral-500",
      cardBorder: "border-neutral-800",
      cardFallbackBg: "bg-neutral-900",
      teamGradient: "bg-gradient-to-br from-amber-500/25 via-amber-600/10 to-neutral-900",
      needsCoachGradient: "bg-gradient-to-br from-red-500/25 via-red-600/10 to-neutral-900",
      coachUnavailableBg: "bg-red-950/60",
      statusBorder: STATUS_BORDER,
      highlightRingOffset: "ring-offset-neutral-950",
      timeText: "text-white",
      labelTextDefault: "text-white",
      labelTextTeam: "text-amber-100",
      labelTextNeedsCoach: "text-red-100",
      metaText: "text-neutral-500",
      badgeHighlightBg: "bg-amber-500/20",
      badgeHighlightText: "text-amber-300",
      badgeUnavailBg: "bg-red-500/20",
      badgeUnavailText: "text-red-300",
      badgePrivateBg: "bg-violet-500/20",
      badgePrivateText: "text-violet-300",
    };
  }
  return {
    pillBg: "bg-neutral-100",
    pillText: "text-neutral-500",
    closedBorder: "border-red-300",
    closedBg: "bg-red-100",
    closedText: "text-red-700",
    emptyBorder: "border-neutral-300",
    emptyText: "text-neutral-500",
    cardBorder: "border-neutral-200",
    cardFallbackBg: "bg-white",
    teamGradient: "bg-gradient-to-br from-amber-200 via-amber-100 to-white",
    needsCoachGradient: "bg-gradient-to-br from-red-200 via-red-100 to-white",
    coachUnavailableBg: "bg-red-100",
    statusBorder: STATUS_BORDER_LIGHT,
    highlightRingOffset: "ring-offset-white",
    timeText: "text-neutral-900",
    labelTextDefault: "text-neutral-900",
    labelTextTeam: "text-amber-900",
    labelTextNeedsCoach: "text-red-900",
    metaText: "text-neutral-500",
    badgeHighlightBg: "bg-amber-100",
    badgeHighlightText: "text-amber-800",
    badgeUnavailBg: "bg-red-100",
    badgeUnavailText: "text-red-700",
    badgePrivateBg: "bg-violet-100",
    badgePrivateText: "text-violet-700",
  };
}

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
  light = false,
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
  // Same light/dark switch as WeekGrid — currently only turned on for
  // /admin/planning (see its own comment for why this isn't the default).
  light?: boolean;
}) {
  const theme = buildTheme(light);
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
                  ? light
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-950"
                  : `${theme.pillBg} ${theme.pillText} ${light ? "hover:text-neutral-900" : "hover:text-white"}`
              }`}
            >
              <span className="block">{DAY_LETTERS[day.getUTCDay()]}</span>
              <span className="block text-[10px] opacity-70">{day.getUTCDate()}</span>
            </Link>
          );
        })}
      </div>

      {closed && (
        <p className={`mb-3 rounded-md border ${theme.closedBorder} ${theme.closedBg} px-3 py-2 text-xs ${theme.closedText}`}>
          Box fermée ce jour-là.
        </p>
      )}

      {dayInstances.length === 0 ? (
        <p className={`rounded-lg border border-dashed ${theme.emptyBorder} py-8 text-center text-sm ${theme.emptyText}`}>
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
                : `border-l-4 ${theme.cardBorder} ${theme.statusBorder[inst.status] ?? theme.statusBorder.PLANNED}`;
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
                    ? theme.teamGradient
                    : needsCoach
                      ? theme.needsCoachGradient
                      : coachUnavailable
                        ? theme.coachUnavailableBg
                        : coachBg
                          ? ""
                          : theme.cardFallbackBg
                } ${isHighlighted ? `ring-2 ring-amber-400 ring-offset-2 ${theme.highlightRingOffset}` : ""} ${
                  coachUnavailable ? "ring-2 ring-red-500" : ""
                }`}
                style={!inst.isTeamEvent && coachBg ? { backgroundColor: coachBg } : undefined}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-sm font-semibold ${theme.timeText}`}>
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
                      <span className={`rounded-full ${theme.badgeHighlightBg} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${theme.badgeHighlightText}`}>
                        Prochain
                      </span>
                    )}
                    {coachUnavailable && (
                      <span className={`rounded-full ${theme.badgeUnavailBg} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${theme.badgeUnavailText}`}>
                        Indisponible
                      </span>
                    )}
                    {inst.isPrivate && (
                      <span className={`rounded-full ${theme.badgePrivateBg} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${theme.badgePrivateText}`}>
                        Privé
                      </span>
                    )}
                    {inst.review && <ReviewDot review={inst.review} />}
                    {headerAction?.(inst)}
                  </div>
                </div>
                <div
                  className={`mb-1 text-[15px] font-semibold ${
                    inst.isTeamEvent ? theme.labelTextTeam : needsCoach ? theme.labelTextNeedsCoach : theme.labelTextDefault
                  }`}
                >
                  {inst.label}
                </div>
                <div className={`mb-2 text-xs ${theme.metaText}`}>{statusLabel(inst.status)}</div>
                {control?.(inst)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
