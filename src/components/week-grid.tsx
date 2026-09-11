import type { ReactNode } from "react";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { timeToMinutes, formatHourLabel, layoutDayEventsToGrid } from "@/lib/calendar-layout";
import { hexToRgba } from "@/lib/coach-colors";
import { statusLabel } from "@/lib/status-labels";
import { ReviewDot } from "@/components/review-button";

export type WeekGridRoom = { id: string; name: string; shortLabel: string | null; color: string | null };

// Falls back to when a room has no color set — same neutral tint regardless
// of which lane it is, unlike the old hardcoded 2-room sky/violet split.
const DEFAULT_ROOM_COLOR = "#525252";

const SLOT_MINUTES = 5;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const HOUR_PX = 80; // A 1-hour class block's rendered height — was 70px,
// bumped up for more breathing room now that a card can also carry an
// assistant badge and up to two review dots under the label.
const ROW_PX = HOUR_PX / SLOTS_PER_HOUR;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const GUTTER_COL = "64px";
// Each day splits into one lane per room (see the `rooms` prop) — narrower
// than a single day column since there can be several, side by side, so a
// room's whole week reads as one vertical scan down its lane instead of a
// background tint that only shows through when nothing else colors the card.
const ROOM_COL = "minmax(90px, 1fr)";

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

// Light-theme counterparts of the two maps above — same semantics, tuned
// for a white grid (see the `light` prop) instead of translucent tints
// meant to blend into a near-black card.
export const STATUS_BORDER_LIGHT: Record<string, string> = {
  PLANNED: "border-l-neutral-400",
  DONE: "border-l-emerald-500",
  MISSED: "border-l-red-500",
  CANCELLED: "border-l-neutral-300",
};

const STATUS_BG_LIGHT: Record<string, string> = {
  DONE: "bg-emerald-100",
  MISSED: "bg-red-100",
  CANCELLED: "bg-neutral-100",
};

// Every color class the grid uses, grouped so WeekGrid can pick the dark
// (default, matches the rest of the admin app) or light set as one unit
// instead of scattering `light ? ... : ...` ternaries through the JSX —
// see the `light` prop, currently only turned on for /admin/planning.
function buildTheme(light: boolean) {
  if (!light) {
    return {
      containerBorder: "border-neutral-800",
      headerBg: "bg-neutral-900",
      headerBgAlt: "bg-neutral-800",
      headerBorder: "border-neutral-800",
      headerText: "text-white",
      closedHeaderBg: "bg-red-950/40",
      closedHeaderText: "text-red-300",
      closedBadgeBg: "bg-red-500/20",
      closedBadgeText: "text-red-300",
      hourLabelText: "text-neutral-500",
      gridLine: "border-neutral-800",
      gridLineStrong: "border-l-neutral-700",
      altDayTint: "bg-white/[0.035]",
      closedHourBg: "bg-red-950/10",
      cardFallbackBg: "bg-neutral-900",
      statusBg: STATUS_BG,
      statusBorder: STATUS_BORDER,
      teamGradient: "bg-gradient-to-br from-amber-500/30 via-amber-600/15 to-neutral-900",
      needsCoachGradient: "bg-gradient-to-br from-red-500/30 via-red-600/15 to-neutral-900",
      teamBorder: "border-amber-400",
      needsCoachBorder: "border-red-400",
      coachUnavailableBg: "bg-red-950/60",
      mineRing: "ring-white/80",
      highlightRingOffset: "ring-offset-neutral-950",
      highlightRing: "ring-amber-400",
      timeText: "text-neutral-300",
      labelTextDefault: "text-white",
      labelTextTeam: "text-amber-100",
      labelTextNeedsCoach: "text-red-100",
      badgeHighlightBg: "bg-amber-500/20",
      badgeHighlightText: "text-amber-300",
      badgeUnavailBg: "bg-red-500/20",
      badgeUnavailText: "text-red-300",
      badgePrivateBg: "bg-violet-500/20",
      badgePrivateText: "text-violet-300",
      badgeAssistBg: "bg-teal-500/20",
      badgeAssistText: "text-teal-300",
      hoverBackdrop: "group-hover:bg-neutral-950/70",
    };
  }
  return {
    containerBorder: "border-neutral-200",
    headerBg: "bg-white",
    headerBgAlt: "bg-neutral-100",
    headerBorder: "border-neutral-200",
    headerText: "text-neutral-900",
    closedHeaderBg: "bg-red-100",
    closedHeaderText: "text-red-700",
    closedBadgeBg: "bg-red-200",
    closedBadgeText: "text-red-800",
    hourLabelText: "text-neutral-400",
    gridLine: "border-neutral-200",
    gridLineStrong: "border-l-neutral-300",
    altDayTint: "bg-neutral-900/[0.035]",
    closedHourBg: "bg-red-50",
    cardFallbackBg: "bg-white",
    statusBg: STATUS_BG_LIGHT,
    statusBorder: STATUS_BORDER_LIGHT,
    teamGradient: "bg-gradient-to-br from-amber-200 via-amber-100 to-white",
    needsCoachGradient: "bg-gradient-to-br from-red-200 via-red-100 to-white",
    teamBorder: "border-amber-500",
    needsCoachBorder: "border-red-500",
    coachUnavailableBg: "bg-red-100",
    mineRing: "ring-neutral-900/70",
    highlightRingOffset: "ring-offset-white",
    highlightRing: "ring-amber-500",
    timeText: "text-neutral-500",
    labelTextDefault: "text-neutral-900",
    labelTextTeam: "text-amber-900",
    labelTextNeedsCoach: "text-red-900",
    badgeHighlightBg: "bg-amber-100",
    badgeHighlightText: "text-amber-800",
    badgeUnavailBg: "bg-red-100",
    badgeUnavailText: "text-red-700",
    badgePrivateBg: "bg-violet-100",
    badgePrivateText: "text-violet-700",
    badgeAssistBg: "bg-teal-100",
    badgeAssistText: "text-teal-700",
    hoverBackdrop: "group-hover:bg-white/90",
  };
}

export type WeekGridInstance = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
  roomId: string;
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
  // The class's coach's own review, if done — first of the two review
  // lines under the label (see the badges-row comment further down).
  // Undefined on grids that don't fetch it (e.g. a coach's own My Classes
  // page), which just renders nothing.
  coachReview?: { id: string; pastille: string } | null;
  // 0, 1 or several people helping the coach run this class (see
  // ClassInstanceAssistant) — surfaced as its own badge, independent of
  // whether either of them has been reviewed yet.
  assistants?: { id: string; name: string }[];
  // Reviews of this class's assistants (as opposed to coachReview above) —
  // the second of the two review lines under the label.
  assistantReviews?: { id: string; pastille: string; coachName: string }[];
};

export function WeekGrid<T extends WeekGridInstance>({
  weekStart,
  instances,
  rooms,
  headerAction,
  control,
  selectionAction,
  highlightCoachId,
  highlightInstanceId,
  unavailableInstanceIds,
  closedDates,
  light = false,
}: {
  weekStart: Date;
  instances: T[];
  // This organization's active rooms, in display order — one lane per room,
  // per day (see ROOM_COL above).
  rooms: WeekGridRoom[];
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
  // Switches the grid to a white background (see buildTheme) — currently
  // only turned on for /admin/planning; a coach's own My Classes grid
  // (my-classes-grid.tsx) leaves this off and keeps the original dark look.
  light?: boolean;
}) {
  const theme = buildTheme(light);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

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
    <div className={`mb-8 max-h-[75vh] overflow-auto rounded-lg border ${theme.containerBorder} ${light ? "bg-white" : ""}`}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${GUTTER_COL} repeat(${7 * rooms.length}, ${ROOM_COL})`,
          gridTemplateRows: `auto repeat(${totalRows}, ${ROW_PX}px)`,
          minWidth: 64 + 7 * rooms.length * 90,
        }}
      >
        {/* Header row — sticky so the day/date labels stay visible while
            scrolling down through the hour grid below (the page itself
            scrolls; nothing above this sticks, so top-0 pins it right under
            the viewport's edge). z-20 keeps it above the event blocks
            (z-10), which would otherwise scroll up underneath it. Each day
            header spans that day's whole lane pair (2 columns), with a
            room sub-row underneath so a lane's room is always readable
            without having to remember left-vs-right. */}
        <div
          className={`sticky top-0 z-20 border-b ${theme.headerBorder} ${theme.headerBg}`}
          style={{ gridColumn: 1, gridRow: 1 }}
        />
        {days.map((day, dayIdx) => {
          const closed = closedDates?.has(formatDateISO(day)) ?? false;
          // Alternates every other day (Tue/Thu/Sat when the week starts
          // Monday) a shade lighter — plain vertical border separators
          // alone were hard to scan across a wide 7-day grid, especially
          // once several room lanes sit side by side within each day.
          const altDay = dayIdx % 2 === 1;
          const firstCol = 2 + dayIdx * rooms.length;
          return (
            <div
              key={formatDateISO(day)}
              className={`sticky top-0 z-20 border-b border-l ${theme.headerBorder} p-2 text-xs font-medium ${closed ? `${theme.closedHeaderBg} ${theme.closedHeaderText}` : altDay ? `${theme.headerBgAlt} ${theme.headerText}` : `${theme.headerBg} ${theme.headerText}`}`}
              style={{ gridColumn: `${firstCol} / ${firstCol + rooms.length}`, gridRow: 1 }}
            >
              <div className="flex items-center justify-between gap-1">
                <span>{formatDayLabel(day)}</span>
                {closed && (
                  <span className={`rounded-full ${theme.closedBadgeBg} px-1.5 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide ${theme.closedBadgeText}`}>
                    Fermé
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-0.5">
                {rooms.map((room) => (
                  <span
                    key={room.id}
                    className="flex-1 truncate rounded px-1 text-center text-[9px] font-semibold"
                    style={{
                      backgroundColor: hexToRgba(room.color ?? DEFAULT_ROOM_COLOR, 0.1) ?? undefined,
                      color: room.color ?? DEFAULT_ROOM_COLOR,
                    }}
                  >
                    {room.shortLabel || room.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Hour labels + background hour cells (grid + separators) — one
            background cell per room lane, not per day, now that each day
            is two columns wide. */}
        {hours.map((hour, hourIdx) => {
          const rowStart = 2 + hourIdx * SLOTS_PER_HOUR;
          const rowEnd = rowStart + SLOTS_PER_HOUR;
          return (
            <div key={`label-${hour}`} className="contents">
              <div
                className={`relative border-t ${theme.gridLine}`}
                style={{ gridColumn: 1, gridRow: `${rowStart} / ${rowEnd}` }}
              >
                <span className={`absolute -top-2 right-2 text-[10px] ${theme.hourLabelText}`}>
                  {formatHourLabel(hour)}
                </span>
              </div>
              {days.map((day, dayIdx) =>
                rooms.map((room, roomIdx) => (
                  <div
                    key={`${formatDateISO(day)}-${room.id}-${hour}`}
                    className={`border-t border-l ${theme.gridLine} ${closedDates?.has(formatDateISO(day)) ? theme.closedHourBg : dayIdx % 2 === 1 ? theme.altDayTint : ""} ${roomIdx === 0 ? theme.gridLineStrong : ""}`}
                    style={{ gridColumn: 2 + dayIdx * rooms.length + roomIdx, gridRow: `${rowStart} / ${rowEnd}` }}
                  />
                ))
              )}
            </div>
          );
        })}

        {/* Events — laid out per room lane, not per day, so two classes
            only get split side-by-side (see layoutDayEventsToGrid) when
            they're in the *same* room at overlapping times; different
            rooms already have their own column and never need to share. */}
        {days.flatMap((day, dayIdx) =>
          rooms.flatMap((room, roomIdx) => {
          const laneInstances = instances.filter(
            (inst) =>
              formatDateISO(inst.date) === formatDateISO(day) &&
              // The fallback (an instance whose roomId doesn't match any of
              // this organization's current rooms, placed in lane 0) is now
              // only reachable if a room was archived out from under
              // historical instances that still reference it — roomId is a
              // real FK, so an unrecognized value should be rare.
              (inst.roomId === room.id ||
                (!rooms.some((r) => r.id === inst.roomId) && roomIdx === 0))
          );
          const positioned = layoutDayEventsToGrid(
            laneInstances,
            rangeStartMinutes,
            SLOT_MINUTES
          );
          const laneColumn = 2 + dayIdx * rooms.length + roomIdx;

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
            const statusBg = theme.statusBg[inst.status];
            const room = roomById.get(inst.roomId);
            // The coach's color now always wins the background, DONE/MISSED
            // included, so a class visually stays "theirs" no matter its
            // outcome — the outcome itself still reads from the border-left
            // color (theme.statusBorder) and the status-labeled title tooltip.
            // Falls back to the status tint, then the room tint, whenever
            // there's no per-coach color to use — no coach assigned, the
            // coach hasn't set one, or this grid doesn't fetch coachColor.
            const coachBg = !coachUnavailable && inst.coachColor
              ? hexToRgba(inst.coachColor, 0.35)
              : null;
            const roomBg = !coachBg && room?.color ? hexToRgba(room.color, 0.2) : null;
            const bg = coachUnavailable
              ? theme.coachUnavailableBg
              : (coachBg || roomBg ? "" : (statusBg ?? theme.cardFallbackBg));
            // A team event overrides every other border/background rule —
            // it has no coach and no status story to tell, just "everyone
            // needs to see this" (see ClassInstance.isTeamEvent). A still-
            // unassigned class gets the same loud treatment (in red instead
            // of amber) since it's the other case that needs the admin's
            // attention before the week is ready.
            const border = inst.isTeamEvent
              ? `border-2 ${theme.teamBorder}`
              : needsCoach
                ? `border-2 ${theme.needsCoachBorder}`
                : `border-l-4 ${theme.statusBorder[inst.status] ?? theme.statusBorder.PLANNED}`;
            return (
              <div
                key={inst.id}
                id={isHighlighted ? `class-instance-${inst.id}` : undefined}
                title={`${inst.isTeamEvent ? "Événement d'équipe · " : ""}${inst.label} · ${room?.name ?? ""} · ${inst.startTime}–${inst.endTime} · ${statusLabel(inst.status)}${coachUnavailable ? " · le coach assigné est indisponible" : ""}`}
                className={`group relative z-10 flex flex-col gap-0.5 overflow-hidden rounded-md p-1 transition-opacity ${border} ${inst.isTeamEvent ? theme.teamGradient : needsCoach ? theme.needsCoachGradient : bg} ${coachUnavailable ? "ring-2 ring-inset ring-red-500" : ""} ${isMineGroup ? `ring-2 ring-inset ${theme.mineRing}` : ""} ${isHighlighted ? `ring-2 ${theme.highlightRing} ring-offset-2 ${theme.highlightRingOffset}` : ""} ${faded ? "opacity-40" : ""}`}
                style={{
                  gridColumn: laneColumn,
                  gridRow: `${1 + rowStart} / ${1 + rowEnd}`,
                  justifySelf: "start",
                  marginLeft: `${left}%`,
                  width: `calc(${width}% - 2px)`,
                  ...(!inst.isTeamEvent && (coachBg || roomBg)
                    ? { backgroundColor: coachBg ?? roomBg ?? undefined }
                    : {}),
                }}
              >
                <div className="flex items-center gap-0.5">
                  <div className="flex min-w-0 shrink items-center gap-1">
                    {selectionAction?.(inst)}
                    {/* Start time only — the end time is already visible as
                        the card's own height on the time axis, and the full
                        range is still in the title tooltip on hover; showing
                        both here was the single biggest thing forcing an
                        early truncation once lanes got this narrow. */}
                    <span className={`truncate font-mono text-[9px] font-semibold ${theme.timeText}`}>
                      {inst.startTime}
                    </span>
                  </div>
                  {/* Badges shrink and clip first — headerAction (review/delete)
                      sits in its own shrink-0 group pinned to the right edge
                      (ml-auto) so it never gets pushed past the block's edge
                      and silently clipped by overflow-hidden, which happened
                      on narrow side-by-side blocks (e.g. two classes at the
                      same time) once the team-event badge alone was wider
                      than the column. "Non assigné" isn't among these — the
                      red border/background already says that, and the coach
                      select below repeats it as its own placeholder, so a
                      third copy of the same word was just clutter once lanes
                      got narrow. */}
                  <div className="flex min-w-0 shrink items-center gap-0.5 overflow-hidden">
                    {inst.isTeamEvent && (
                      <span className="shrink-0 rounded-full bg-amber-400 px-1 py-0.5 text-[9px] leading-none" title="Événement d'équipe">
                        🎉
                      </span>
                    )}
                    {isHighlighted && (
                      <span className={`shrink-0 rounded-full ${theme.badgeHighlightBg} px-1 py-0.5 text-[7px] font-semibold uppercase leading-none tracking-wide ${theme.badgeHighlightText}`}>
                        Prochain
                      </span>
                    )}
                    {coachUnavailable && (
                      <span className={`shrink-0 rounded-full ${theme.badgeUnavailBg} px-1 py-0.5 text-[7px] font-semibold uppercase leading-none tracking-wide ${theme.badgeUnavailText}`}>
                        Indispo
                      </span>
                    )}
                    {inst.isPrivate && (
                      <span className={`shrink-0 rounded-full ${theme.badgePrivateBg} px-1 py-0.5 text-[7px] font-semibold uppercase leading-none tracking-wide ${theme.badgePrivateText}`}>
                        Privé
                      </span>
                    )}
                    {inst.assistants && inst.assistants.length > 0 && (
                      <span
                        className={`shrink-0 truncate rounded-full ${theme.badgeAssistBg} px-1 py-0.5 text-[7px] font-semibold uppercase leading-none tracking-wide ${theme.badgeAssistText}`}
                        title={`Assistant(s) : ${inst.assistants.map((a) => a.name).join(", ")}`}
                      >
                        🤝 {inst.assistants.map((a) => a.name).join(", ")}
                      </span>
                    )}
                  </div>
                  {/* Absolutely positioned (not ml-auto in the flow) so
                      these — invisible until hover — stop permanently
                      reserving width in lanes this narrow; they only ever
                      overlap the time/badges on hover, when that's exactly
                      the card being acted on anyway. */}
                  <div className={`absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded px-0.5 ${theme.hoverBackdrop}`}>
                    {headerAction?.(inst)}
                  </div>
                </div>
                <div
                  className={`line-clamp-2 text-[10.5px] font-semibold leading-tight ${
                    inst.isTeamEvent ? theme.labelTextTeam : needsCoach ? theme.labelTextNeedsCoach : theme.labelTextDefault
                  }`}
                >
                  {inst.label}
                </div>
                {/* Two lines, not one row — the coach's review and an
                    assistant's are about two different people, so they
                    read top-to-bottom instead of blurring into one row of
                    same-looking dots. Fill color still only ever means the
                    pastille outcome (unchanged from before assistants
                    existed); which line a dot is on is what says who it's
                    about. */}
                {inst.coachReview && (
                  <div className="flex items-center">
                    <ReviewDot review={inst.coachReview} />
                  </div>
                )}
                {inst.assistantReviews && inst.assistantReviews.length > 0 && (
                  <div className="flex items-center gap-1">
                    {inst.assistantReviews.map((r) => (
                      <ReviewDot key={r.id} review={r} />
                    ))}
                  </div>
                )}
                <div className="mt-auto">{control(inst)}</div>
              </div>
            );
          });
        })
        )}
      </div>
    </div>
  );
}
