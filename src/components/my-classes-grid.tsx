import { WeekGrid, type WeekGridInstance } from "@/components/week-grid";
import { SubstituteSelect } from "@/components/substitute-select";
import { statusLabel } from "@/lib/status-labels";

type Instance = WeekGridInstance & {
  substituteCoachId: string | null;
  coach: { name: string } | null;
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
  instances,
  coachId,
  coaches,
  locked,
}: {
  weekStart: Date;
  instances: Instance[];
  coachId: string;
  coaches: { id: string; name: string }[];
  locked: boolean;
}) {
  return (
    <WeekGrid
      weekStart={weekStart}
      instances={instances}
      highlightCoachId={coachId}
      control={(inst) => (
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
        </div>
      )}
    />
  );
}
