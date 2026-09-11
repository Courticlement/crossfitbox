import { formatDayLabel } from "@/lib/dates";

export type AssistedClass = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
  roomName: string;
  coachName: string | null;
  status: string;
};

// A coach's own "I'm assisting these" list on /upload — separate from
// MyClassesGrid above it (which is about classes they *coach*) since an
// assisted class already has its own coach and its own CoachSelect/status
// story; mixing the two into one grid would just be confusing. Read-only
// for now — declaring Fait/Manqué stays the coach's call, not the
// assistant's (see the assistant-coaches proposal's "AN ASSISTANT'S OWN
// SPACE" section).
export function MyAssistedClasses({ instances }: { instances: AssistedClass[] }) {
  if (instances.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-teal-900 bg-teal-950/20 p-4">
      <h2 className="mb-1 text-sm font-medium text-white">🤝 Cours où j&apos;assiste cette semaine</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Vous aidez le coach sur ces cours — le statut (Fait/Manqué) reste géré par lui.
      </p>
      <div className="flex flex-col gap-2">
        {instances.map((inst) => (
          <div
            key={inst.id}
            className="flex items-center justify-between gap-3 rounded-md border border-teal-900/60 bg-neutral-950 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-white">{inst.label}</div>
              <div className="truncate text-xs text-neutral-500">
                {formatDayLabel(inst.date)} · {inst.startTime}–{inst.endTime} · {inst.roomName}
                {inst.coachName ? ` · Coach : ${inst.coachName}` : ""}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
              Assistant·e
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
