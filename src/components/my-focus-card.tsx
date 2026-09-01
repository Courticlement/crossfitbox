import { formatDayLabel } from "@/lib/dates";
import type { LastFocus } from "@/lib/coaching-focus";

// The coach's own view of the same standing focus shown to the head coach —
// deliberately bare next to CoachingFocusPanel: no pastille (that's the
// head coach's holistic call, not something to hand back as a grade) and no
// "what you identified" quote (that belongs to the debrief moment, not a
// standing reminder).
export function MyFocusCard({ focus }: { focus: LastFocus | null }) {
  if (!focus) return null;

  return (
    <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        🎯 Votre axe de travail actuel
      </p>
      <p className="mb-2 text-base font-semibold leading-relaxed text-white">{focus.focusText}</p>
      <p className="text-xs text-neutral-500">
        Donné le {formatDayLabel(focus.date)} · {focus.classLabel}
      </p>
    </div>
  );
}
