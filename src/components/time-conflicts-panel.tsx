import { dismissSubmission } from "@/lib/actions/submissions";
import { formatDayLabel } from "@/lib/dates";

export type TimeConflictGroup = {
  coachName: string;
  classes: {
    submissionId: string;
    label: string;
    room: string;
    date: Date;
    startTime: string;
    endTime: string;
  }[];
};

export function TimeConflictsPanel({ groups }: { groups: TimeConflictGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-900 bg-red-950/20 p-4">
      <h2 className="mb-1 text-sm font-medium text-red-200">
        Même coach, cours qui se chevauchent
      </h2>
      <p className="mb-3 text-xs text-red-300/70">
        Un coach a déclaré avoir fait deux cours ou plus qui se chevauchent
        dans le temps — c&apos;est forcément une erreur. Rejetez la déclaration
        incorrecte.
      </p>
      <div className="flex flex-col gap-3">
        {groups.map((group, i) => (
          <div
            key={i}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
          >
            <div className="mb-2 font-medium text-white">{group.coachName}</div>
            <div className="flex flex-col gap-1">
              {group.classes.map((cls) => (
                <div
                  key={cls.submissionId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-800 px-2 py-1"
                >
                  <span className="text-neutral-300">
                    <span className="font-medium text-white">{cls.label}</span>{" "}
                    <span className="text-neutral-500">
                      · {formatDayLabel(cls.date)} · {cls.startTime}–{cls.endTime} ·{" "}
                      {cls.room}
                    </span>
                  </span>
                  <form action={dismissSubmission}>
                    <input type="hidden" name="submissionId" value={cls.submissionId} />
                    <button
                      type="submit"
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Rejeter
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
