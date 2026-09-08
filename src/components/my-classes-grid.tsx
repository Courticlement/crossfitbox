import { WeekGrid, type WeekGridInstance, type WeekGridRoom } from "@/components/week-grid";
import { DayAgenda } from "@/components/day-agenda";
import { SubstituteSelect } from "@/components/substitute-select";
import { ClaimClassButton } from "@/components/claim-class-button";
import { withdrawClaim } from "@/lib/actions/claims";
import { statusLabel } from "@/lib/status-labels";

type Instance = WeekGridInstance & {
  substituteCoachId: string | null;
  coach: { name: string } | null;
  // This coach's own claim on the class (see loadCoachWeekData) — at most
  // one entry, since ClassClaim is unique per (classInstanceId, coachId).
  claims: { id: string; status: string }[];
};

const STATUS_TEXT_COLOR: Record<string, string> = {
  DONE: "text-emerald-400",
  MISSED: "text-red-400",
  PLANNED: "text-neutral-500",
  CANCELLED: "text-neutral-600",
};

// A coach's read-only view of the week: who's assigned and whether the
// admin has validated each class Fait/Manqué (see bulkSetClassStatus in
// actions/planning.ts — coaches no longer self-report this). The only thing
// still editable here is naming a substitute once the admin has marked a
// class Manqué.
export function MyClassesGrid({
  weekStart,
  selectedDay,
  dayHrefs,
  instances,
  rooms,
  coachId,
  coaches,
  locked,
}: {
  weekStart: Date;
  // See DayAgenda — the mobile day-at-a-time counterpart to the week grid
  // below, resolved by the caller (upload/page.tsx) from a `day` param.
  selectedDay: Date;
  dayHrefs: Record<string, string>;
  instances: Instance[];
  rooms: WeekGridRoom[];
  coachId: string;
  coaches: { id: string; name: string }[];
  locked: boolean;
}) {
  const renderControl = (inst: Instance) => {
    // Same eligibility rule as claimClass itself (see lib/actions/claims.ts)
    // — a team event is never assigned to anyone by design, and a cancelled
    // class isn't up for grabs.
    const claimable = !inst.coachId && !inst.isTeamEvent && inst.status !== "CANCELLED";
    const pendingClaim = inst.claims.find((c) => c.status === "PENDING");

    return (
      <div className="flex flex-col gap-0.5">
        {inst.coach?.name && (
          <div className="truncate text-[9px] text-neutral-500">
            Assigné : {inst.coach.name}
          </div>
        )}
        <div className={`truncate text-[10px] font-medium ${STATUS_TEXT_COLOR[inst.status] ?? ""}`}>
          {statusLabel(inst.status)}
        </div>
        {inst.status === "MISSED" && (
          <SubstituteSelect
            classInstanceId={inst.id}
            coachId={inst.coachId}
            substituteCoachId={inst.substituteCoachId}
            coaches={coaches}
            locked={locked}
          />
        )}
        {claimable &&
          (pendingClaim ? (
            // One line, not stacked — WeekGrid sizes a class block to its
            // actual duration on the time axis (see week-grid.tsx), so a
            // 30-60min slot has no room to spare for a second line here.
            <div className="flex min-w-0 items-center gap-1" title="En attente de validation par l'admin">
              <span className="truncate text-[9px] font-medium text-amber-400">En attente</span>
              {!locked && (
                <form action={withdrawClaim} className="shrink-0">
                  <input type="hidden" name="id" value={pendingClaim.id} />
                  <button
                    type="submit"
                    title="Annuler la demande"
                    className="text-[9px] text-neutral-500 underline hover:text-white"
                  >
                    Annuler
                  </button>
                </form>
              )}
            </div>
          ) : (
            <ClaimClassButton classInstanceId={inst.id} locked={locked} />
          ))}
      </div>
    );
  };

  return (
    <>
      <div className="hidden md:block">
        <WeekGrid
          weekStart={weekStart}
          instances={instances}
          rooms={rooms}
          highlightCoachId={coachId}
          control={renderControl}
        />
      </div>
      <DayAgenda
        weekStart={weekStart}
        selectedDay={selectedDay}
        dayHrefs={dayHrefs}
        instances={instances}
        rooms={rooms}
        control={renderControl}
        emptyLabel="Aucun cours ce jour-là."
      />
    </>
  );
}
