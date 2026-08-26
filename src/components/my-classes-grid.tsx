"use client";

import { useState } from "react";
import { WeekGrid, type WeekGridInstance } from "@/components/week-grid";
import { SubmissionEditor } from "@/components/submission-editor";

type Instance = WeekGridInstance & {
  substituteCoachId: string | null;
  coach: { name: string } | null;
};

// Owns the coach's not-yet-saved status picks for every class in the week,
// lifted up from each SubmissionEditor so the "Mark all as Done" button
// below can fill in several at once — a plain per-select useState can't be
// reached from outside the component it lives in.
export function MyClassesGrid({
  weekStart,
  instances,
  coachId,
  coaches,
  mySubmissionByInstance,
  bulkFormId,
  locked,
}: {
  weekStart: Date;
  instances: Instance[];
  coachId: string;
  coaches: { id: string; name: string }[];
  mySubmissionByInstance: Map<string, { status: string }>;
  bulkFormId: string;
  locked: boolean;
}) {
  const [pending, setPending] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      instances.map((inst) => [inst.id, mySubmissionByInstance.get(inst.id)?.status ?? ""])
    )
  );

  const setOne = (classInstanceId: string, status: string) =>
    setPending((prev) => ({ ...prev, [classInstanceId]: status }));

  // Only fills in classes assigned to this coach that don't already have a
  // status picked — never overwrites an existing Done or Missed pick, saved
  // or not.
  const eligibleIds = instances
    .filter((inst) => inst.coachId === coachId && !inst.isPrivate && !pending[inst.id])
    .map((inst) => inst.id);

  const markAllDone = () => {
    setPending((prev) => {
      const next = { ...prev };
      for (const id of eligibleIds) next[id] = "DONE";
      return next;
    });
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={markAllDone}
          disabled={locked || eligibleIds.length === 0}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-300 hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Marquer tous mes cours collectifs comme faits
        </button>
      </div>

      <WeekGrid
        weekStart={weekStart}
        instances={instances}
        highlightCoachId={coachId}
        control={(inst) => (
          <SubmissionEditor
            classInstanceId={inst.id}
            coachId={coachId}
            assignedCoachName={inst.coach?.name ?? null}
            mySubmission={mySubmissionByInstance.get(inst.id) ?? null}
            bulkFormId={bulkFormId}
            status={inst.status}
            substituteCoachId={inst.substituteCoachId}
            coaches={coaches}
            locked={locked}
            pendingStatus={pending[inst.id] ?? ""}
            onPendingStatusChange={setOne}
          />
        )}
      />
    </>
  );
}
