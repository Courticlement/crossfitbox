"use client";

import { clearMySubmission } from "@/lib/actions/submissions";
import { SubstituteSelect } from "@/components/substitute-select";

export function SubmissionEditor({
  classInstanceId,
  coachId,
  assignedCoachName,
  mySubmission,
  bulkFormId,
  status: savedStatus,
  substituteCoachId,
  coaches,
  locked,
  pendingStatus,
  onPendingStatusChange,
}: {
  classInstanceId: string;
  coachId: string;
  assignedCoachName: string | null;
  mySubmission: { status: string } | null;
  // The shared form (see the page's "Save all changes" button) this
  // select's value is submitted with — associated via the `form=`
  // attribute rather than nesting, since it lives outside this component.
  bulkFormId: string;
  // The class's actual saved status (not the coach's pending selection
  // below) — the substitute picker only shows once Missed is genuinely
  // saved, not the moment it's picked but not yet submitted, so it can't
  // end up assigning a substitute to a status that never got saved.
  status: string;
  substituteCoachId: string | null;
  coaches: { id: string; name: string }[];
  locked?: boolean;
  // The coach's not-yet-saved pick, lifted up to the parent grid so a
  // "Mark all as Done" bulk action can fill it in for multiple classes at
  // once — see MyClassesGrid.
  pendingStatus: string;
  onPendingStatusChange: (classInstanceId: string, status: string) => void;
}) {
  const status = pendingStatus;
  const dirty = status !== "" && status !== (mySubmission?.status ?? "");

  return (
    <div className="flex flex-col gap-0.5">
      {assignedCoachName && (
        <div className="truncate text-[9px] text-neutral-500">
          Assigned: {assignedCoachName}
        </div>
      )}
      <div className="flex items-center gap-1">
        <input type="hidden" name="ids" value={classInstanceId} form={bulkFormId} />
        <select
          name={`status:${classInstanceId}`}
          form={bulkFormId}
          value={status}
          disabled={locked}
          onChange={(e) => onPendingStatusChange(classInstanceId, e.currentTarget.value)}
          title={locked ? "This week is validated — reporting is closed" : dirty ? "Not saved yet — click \"Save all changes\"" : undefined}
          className={`w-full truncate rounded border px-1 py-0.5 text-[10px] text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
            dirty
              ? "border-amber-600 bg-amber-950/20 focus:border-amber-400"
              : "border-neutral-700 bg-neutral-950 focus:border-neutral-500"
          }`}
        >
          <option value="" disabled>
            I did...
          </option>
          <option value="DONE">Done</option>
          <option value="MISSED">Missed</option>
        </select>
        {mySubmission && !locked && (
          <form action={clearMySubmission}>
            <input type="hidden" name="classInstanceId" value={classInstanceId} />
            <input type="hidden" name="coachId" value={coachId} />
            <button
              type="submit"
              className="shrink-0 text-[9px] text-neutral-500 hover:text-red-300"
            >
              Clear
            </button>
          </form>
        )}
      </div>
      {savedStatus === "MISSED" && (
        <SubstituteSelect
          classInstanceId={classInstanceId}
          coachId={coachId}
          substituteCoachId={substituteCoachId}
          coaches={coaches}
          locked={locked}
        />
      )}
    </div>
  );
}
