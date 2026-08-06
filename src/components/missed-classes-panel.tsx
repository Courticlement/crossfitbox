import { SubstituteSelect } from "@/components/substitute-select";
import { formatDayLabel } from "@/lib/dates";

export type MissedClassInstance = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
  room: string;
  coachId: string | null;
  substituteCoachId: string | null;
};

export function MissedClassesPanel({
  title,
  instances,
  coaches,
  showMissedBy,
}: {
  title: string;
  instances: MissedClassInstance[];
  coaches: { id: string; name: string }[];
  showMissedBy?: boolean;
}) {
  if (instances.length === 0) return null;

  const coachNameById = new Map(coaches.map((c) => [c.id, c.name]));

  return (
    <div className="mb-8 rounded-lg border border-amber-900 bg-amber-950/20 p-4">
      <h2 className="mb-3 text-sm font-medium text-amber-200">{title}</h2>
      <div className="flex flex-col gap-2">
        {instances.map((inst) => (
          <div
            key={inst.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
          >
            <div className="text-neutral-300">
              <span className="font-medium text-white">{inst.label}</span>{" "}
              <span className="text-neutral-500">
                · {formatDayLabel(inst.date)} · {inst.startTime}–{inst.endTime} · {inst.room}
              </span>
              {showMissedBy && inst.coachId && (
                <span className="text-neutral-500">
                  {" "}
                  · missed by {coachNameById.get(inst.coachId) ?? "Unknown"}
                </span>
              )}
            </div>
            <div className="w-48 shrink-0">
              <SubstituteSelect
                classInstanceId={inst.id}
                coachId={inst.coachId}
                substituteCoachId={inst.substituteCoachId}
                coaches={coaches}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
