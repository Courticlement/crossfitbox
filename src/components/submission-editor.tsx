"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { submitClassReport, clearMySubmission } from "@/lib/actions/submissions";

function StatusSelect({
  status,
  onChange,
}: {
  status: string;
  onChange: (next: string) => void;
}) {
  // useFormStatus reads the pending state of the nearest enclosing <form>,
  // so this disables itself while a save is in flight — makes it obvious
  // when it's safe to move on to the next class instead of clicking through
  // while the previous save is still settling.
  const { pending } = useFormStatus();
  return (
    <select
      name="status"
      value={status}
      disabled={pending}
      onChange={(e) => onChange(e.currentTarget.value)}
      className="w-full truncate rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5 text-[10px] text-white focus:border-neutral-500 focus:outline-none disabled:opacity-50"
    >
      <option value="" disabled>
        I did...
      </option>
      <option value="DONE">Done</option>
      <option value="MISSED">Missed</option>
    </select>
  );
}

// Submits via the form's default action (submitClassReport). Uses
// formAction to divert to clearMySubmission instead, so a mistaken
// validation can always be undone rather than being stuck once picked.
function ClearButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={clearMySubmission}
      disabled={pending}
      className="shrink-0 text-[9px] text-neutral-500 hover:text-red-300 disabled:opacity-50"
    >
      Clear
    </button>
  );
}

// Picking a status no longer saves it immediately — this confirms it. Only
// enabled once there's an actual pending choice to commit, so it's obvious
// whether a selection has been saved yet or is still just sitting in the
// dropdown.
function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !dirty}
      className="shrink-0 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[9px] font-medium text-white hover:border-neutral-500 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-neutral-600"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function SubmissionEditor({
  classInstanceId,
  coachId,
  assignedCoachName,
  mySubmission,
}: {
  classInstanceId: string;
  coachId: string;
  assignedCoachName: string | null;
  mySubmission: { status: string } | null;
}) {
  const [status, setStatus] = useState(mySubmission?.status ?? "");
  const dirty = status !== "" && status !== (mySubmission?.status ?? "");

  return (
    <div className="flex flex-col gap-0.5">
      {assignedCoachName && (
        <div className="truncate text-[9px] text-neutral-500">
          Assigned: {assignedCoachName}
        </div>
      )}
      <form action={submitClassReport} className="flex flex-col gap-1">
        <input type="hidden" name="classInstanceId" value={classInstanceId} />
        <input type="hidden" name="coachId" value={coachId} />
        <div className="flex items-center gap-1">
          <StatusSelect status={status} onChange={setStatus} />
          {mySubmission && <ClearButton />}
        </div>
        <SaveButton dirty={dirty} />
      </form>
    </div>
  );
}
