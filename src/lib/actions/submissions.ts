"use server";

import { z } from "zod";
import { refresh, revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, parseDateOnly } from "@/lib/dates";
import { isDateInValidatedWeek, isWeekValidated } from "@/lib/planning-lock";

function revalidateAll() {
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
  refresh();
}

type OfficialSubmission = {
  coachId: string;
  status: string;
} | null;

// Applies a submission as the class's official record, or (if null) resets
// the class back to an unreported PLANNED state.
//
// For a DONE report, coachId is overwritten to whoever just reported it —
// there's no "earliest wins" gate, so the most recent DONE report is always
// what's reflected. This means any coach can reclaim a wrongly-claimed class
// just by reporting it themselves, and a coach who made a mistake can fix it
// by clearing their own submission (see clearMySubmission below), which
// re-derives the class from whatever's left.
//
// A MISSED report never changes coachId — it records that the class was
// missed without reassigning who's on the hook for it. substituteCoachId
// (who actually covered a missed class, set separately via assignSubstitute)
// is preserved across MISSED reports so re-submitting doesn't clobber it,
// but is cleared on a DONE report — once someone confirms they personally
// delivered the class, a leftover "covered by" note no longer applies.
//
// When no submission is left at all, coachId is deliberately left alone —
// undoing a self-report shouldn't also erase the Planning assignment (or a
// previous coach's claim) that had nothing to do with it. An admin can
// always explicitly unassign a class from the Planning tab if that's really
// what's needed.
async function applyOfficial(classInstanceId: string, submission: OfficialSubmission) {
  const instance = await prisma.classInstance.findUnique({ where: { id: classInstanceId } });
  if (!instance) return;

  if (!submission) {
    await prisma.classInstance.update({
      where: { id: classInstanceId },
      data: { status: "PLANNED", substituteCoachId: null },
    });
    return;
  }

  await prisma.classInstance.update({
    where: { id: classInstanceId },
    data: {
      status: submission.status,
      coachId: submission.status === "DONE" ? submission.coachId : instance.coachId,
      substituteCoachId: submission.status === "DONE" ? null : instance.substituteCoachId,
    },
  });
}

const StatusValue = z.enum(["DONE", "MISSED"]);

// Batch save for My Classes: every class's status select on the week grid
// lives in one shared form (see the `ids` hidden inputs, one per class),
// namespaced per class instance id (`status:${id}`) the same way Class
// Templates' bulk save works — one submit reports every class the coach
// picked a status for. Rows still at the unselected placeholder are
// skipped rather than erroring the whole save. Any coach can report on any
// class in the week, not just the one they're assigned to — and every
// report takes effect immediately as the class's official record. All
// submissions are kept (not just the latest), so if a report turns out to
// be wrong, clearing it falls back to whatever's next most recent instead
// of losing the history.
export async function submitClassReports(formData: FormData) {
  const coachId = String(formData.get("coachId") ?? "");
  if (!coachId) return;

  const ids = Array.from(new Set(formData.getAll("ids").map(String)));

  await Promise.all(
    ids.map(async (classInstanceId) => {
      const parsed = StatusValue.safeParse(formData.get(`status:${classInstanceId}`));
      if (!parsed.success) return;
      const status = parsed.data;

      const instance = await prisma.classInstance.findUnique({ where: { id: classInstanceId } });
      if (!instance) return;
      if (await isDateInValidatedWeek(instance.date)) return;

      await prisma.classSubmission.upsert({
        where: { classInstanceId_coachId: { classInstanceId, coachId } },
        create: { classInstanceId, coachId, status },
        update: { status },
      });

      await applyOfficial(classInstanceId, { coachId, status });
    })
  );

  revalidateAll();
}

// Self-service undo: a coach clears their own mistaken submission. The
// class's official record is re-derived from whatever's now the most
// recently updated remaining submission (from any coach), or reset to
// PLANNED with nobody credited if none are left.
export async function clearMySubmission(formData: FormData) {
  const classInstanceId = String(formData.get("classInstanceId") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!classInstanceId || !coachId) return;

  const instance = await prisma.classInstance.findUnique({ where: { id: classInstanceId } });
  if (!instance) return;
  if (await isDateInValidatedWeek(instance.date)) return;

  await prisma.classSubmission.deleteMany({ where: { classInstanceId, coachId } });

  const remaining = await prisma.classSubmission.findFirst({
    where: { classInstanceId },
    orderBy: { updatedAt: "desc" },
  });

  await applyOfficial(classInstanceId, remaining);
  revalidateAll();
}

// Admin conflict resolution: force a specific submission to be the official
// record (even if it's not the most recent one), then drop the other DONE
// submissions for that class since the conflict is now settled.
export async function useSubmission(formData: FormData) {
  const classInstanceId = String(formData.get("classInstanceId") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!classInstanceId || !coachId) return;

  const submission = await prisma.classSubmission.findUnique({
    where: { classInstanceId_coachId: { classInstanceId, coachId } },
  });
  if (!submission) return;

  await applyOfficial(classInstanceId, submission);
  await prisma.classSubmission.deleteMany({
    where: { classInstanceId, coachId: { not: coachId }, status: "DONE" },
  });

  revalidateAll();
}

// Admin conflict resolution: discard one coach's claim. The class's official
// record is always re-derived from whatever report is now the most recently
// updated remaining one (or reset to PLANNED if none are left) — this keeps
// things correct whether the dismissed claim was the official one or just a
// competing one.
export async function dismissSubmission(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return;

  const submission = await prisma.classSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return;
  const { classInstanceId } = submission;

  await prisma.classSubmission.delete({ where: { id: submissionId } }).catch(() => {});

  const remaining = await prisma.classSubmission.findFirst({
    where: { classInstanceId },
    orderBy: { updatedAt: "desc" },
  });

  await applyOfficial(classInstanceId, remaining);
  revalidateAll();
}

const PrivateClassSchema = z
  .object({
    coachId: z.string().min(1),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

// Coach self-report of a private (1:1 or small-group) lesson they gave that
// week — these typically aren't on the fixed weekly template grid, so there's
// no existing ClassInstance to mark DONE against. This creates one directly,
// already DONE since the coach is reporting it after the fact.
export async function addPrivateClass(formData: FormData) {
  const parsed = PrivateClassSchema.safeParse({
    coachId: formData.get("coachId"),
    weekStart: formData.get("weekStart"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return;

  const { coachId, weekStart, dayOfWeek, startTime, endTime } = parsed.data;

  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach) return;

  const weekStartDate = parseDateOnly(weekStart);
  if (!weekStartDate) return;
  if (await isWeekValidated(weekStartDate)) return;

  await prisma.classInstance.create({
    data: {
      date: addDays(weekStartDate, dayOfWeek - 1),
      startTime,
      endTime,
      label: "Private class",
      isPrivate: true,
      status: "DONE",
      coachId,
    },
  });

  revalidateAll();
}

// Scoped to the reporting coach's own private classes — a forged coachId
// just fails the ownership check instead of deleting someone else's record.
export async function deletePrivateClass(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!id || !coachId) return;

  const instance = await prisma.classInstance.findFirst({
    where: { id, coachId, isPrivate: true },
  });
  if (!instance) return;
  if (await isDateInValidatedWeek(instance.date)) return;

  await prisma.classInstance.delete({ where: { id: instance.id } });

  revalidateAll();
}
