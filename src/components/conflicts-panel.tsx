import { useSubmission, dismissSubmission } from "@/lib/actions/submissions";
import { formatDayLabel } from "@/lib/dates";

export type ConflictInstance = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
  room: string;
  officialCoachId: string | null;
  submissions: {
    id: string;
    coachId: string;
    coachName: string;
  }[];
};

export function ConflictsPanel({ instances }: { instances: ConflictInstance[] }) {
  if (instances.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-900 bg-red-950/20 p-4">
      <h2 className="mb-1 text-sm font-medium text-red-200">
        Déclarations en conflit
      </h2>
      <p className="mb-3 text-xs text-red-300/70">
        Plusieurs coachs ont déclaré avoir fait le même cours — celui déclaré
        le plus récemment est actuellement marqué « Actuel ». Forcez-en un
        autre à être actuel, ou rejetez une déclaration erronée.
      </p>
      <div className="flex flex-col gap-3">
        {instances.map((inst) => (
          <div
            key={inst.id}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
          >
            <div className="mb-2 text-neutral-300">
              <span className="font-medium text-white">{inst.label}</span>{" "}
              <span className="text-neutral-500">
                · {formatDayLabel(inst.date)} · {inst.startTime}–{inst.endTime} ·{" "}
                {inst.room}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {inst.submissions.map((sub) => {
                const isOfficial = sub.coachId === inst.officialCoachId;
                return (
                  <div
                    key={sub.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-800 px-2 py-1"
                  >
                    <span className="text-neutral-300">
                      {sub.coachName}
                      {isOfficial && (
                        <span className="ml-2 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-300">
                          Actuel
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      {!isOfficial && (
                        <form action={useSubmission}>
                          <input type="hidden" name="classInstanceId" value={inst.id} />
                          <input type="hidden" name="coachId" value={sub.coachId} />
                          <button
                            type="submit"
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            Utiliser
                          </button>
                        </form>
                      )}
                      <form action={dismissSubmission}>
                        <input type="hidden" name="submissionId" value={sub.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Rejeter
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
