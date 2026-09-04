"use server";

import { z } from "zod";
import { refresh, revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { addDays, parseDateOnly } from "@/lib/dates";
import { isDateInValidatedWeek, isWeekValidated } from "@/lib/planning-lock";
import { requireCoachSession, requireOrgAdmin } from "@/lib/auth-context";

function revalidateAll() {
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
  refresh();
}

// Blocks self-service writes (log or delete a private class) from a coach
// who's been archived — their private link may still be bookmarked, but
// they're no longer a coach at the box. Admin-side conflict resolution
// (useSubmission/dismissSubmission) isn't gated by this, since that's the
// admin acting on old history, not the coach uploading.
async function assertCoachActive(db: PrismaClient, coachId: string): Promise<boolean> {
  const coach = await db.coach.findUnique({ where: { id: coachId }, select: { archived: true } });
  return coach !== null && !coach.archived;
}

type OfficialSubmission = {
  coachId: string;
  status: string;
} | null;

// Applies a submission as the class's official record, or (if null) resets
// the class back to an unreported PLANNED state. Only reachable now via the
// admin's conflict-resolution actions below (useSubmission/dismissSubmission)
// — coaches no longer self-report, see bulkSetClassStatus in actions/planning.ts.
//
// For a DONE report, coachId is overwritten to whoever the admin picked as
// official — this re-derives from whatever's left among the historical
// submissions.
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
// what's needed. classInstanceId is assumed already ownership-checked by
// the caller (useSubmission/dismissSubmission/dismissSubmissions).
async function applyOfficial(
  db: PrismaClient,
  classInstanceId: string,
  submission: OfficialSubmission
) {
  const instance = await db.classInstance.findUnique({ where: { id: classInstanceId } });
  if (!instance) return;

  if (!submission) {
    await db.classInstance.update({
      where: { id: classInstanceId },
      data: { status: "PLANNED", substituteCoachId: null },
    });
    return;
  }

  await db.classInstance.update({
    where: { id: classInstanceId },
    data: {
      status: submission.status,
      coachId: submission.status === "DONE" ? submission.coachId : instance.coachId,
      substituteCoachId: submission.status === "DONE" ? null : instance.substituteCoachId,
    },
  });
}

// Admin conflict resolution: force a specific submission to be the official
// record (even if it's not the most recent one), then drop the other DONE
// submissions for that class since the conflict is now settled.
export async function useSubmission(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const classInstanceId = String(formData.get("classInstanceId") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!classInstanceId || !coachId) return;

  const submission = await prisma.classSubmission.findFirst({
    where: { classInstanceId, coachId },
  });
  if (!submission) return;

  await applyOfficial(prisma, classInstanceId, submission);
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
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return;

  const submission = await prisma.classSubmission.findFirst({ where: { id: submissionId } });
  if (!submission) return;
  const { classInstanceId } = submission;

  await prisma.classSubmission.delete({ where: { id: submissionId } }).catch(() => {});

  const remaining = await prisma.classSubmission.findFirst({
    where: { classInstanceId },
    orderBy: { updatedAt: "desc" },
  });

  await applyOfficial(prisma, classInstanceId, remaining);
  revalidateAll();
}

// Bulk version of dismissSubmission for the admin Data tab, where a whole
// batch of declarations can be selected at once. Processed sequentially
// (not Promise.all) since submissions for the same classInstanceId would
// otherwise race on applyOfficial's re-derivation.
export async function dismissSubmissions(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const ids = Array.from(new Set(formData.getAll("submissionIds").map(String).filter(Boolean)));
  if (ids.length === 0) return;

  for (const submissionId of ids) {
    const submission = await prisma.classSubmission.findFirst({ where: { id: submissionId } });
    if (!submission) continue;
    const { classInstanceId } = submission;

    await prisma.classSubmission.delete({ where: { id: submissionId } }).catch(() => {});

    const remaining = await prisma.classSubmission.findFirst({
      where: { classInstanceId },
      orderBy: { updatedAt: "desc" },
    });
    await applyOfficial(prisma, classInstanceId, remaining);
  }

  revalidateAll();
}

const PrivateClassSchema = z
  .object({
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
// already DONE since the coach is reporting it after the fact. roomId isn't
// meaningful for a 1:1 session — it's set to the org's default (oldest
// active) room purely so ClassInstance's required roomId is satisfied and
// the class still renders somewhere reasonable on the Planning grid.
export async function addPrivateClass(formData: FormData) {
  const session = await requireCoachSession();
  if (!session) return;
  const { coachId, organizationId } = session;
  const prisma = tenantPrisma(organizationId);

  const parsed = PrivateClassSchema.safeParse({
    weekStart: formData.get("weekStart"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return;

  const { weekStart, dayOfWeek, startTime, endTime } = parsed.data;

  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach || coach.archived) return;

  const weekStartDate = parseDateOnly(weekStart);
  if (!weekStartDate) return;
  if (await isWeekValidated(organizationId, weekStartDate)) return;

  const defaultRoom = await prisma.room.findFirst({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
  if (!defaultRoom) return;

  await prisma.classInstance.create({
    data: {
      date: addDays(weekStartDate, dayOfWeek - 1),
      startTime,
      endTime,
      label: "Cours privé",
      roomId: defaultRoom.id,
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
  const session = await requireCoachSession();
  const id = String(formData.get("id") ?? "");
  if (!id || !session) return;
  const { coachId, organizationId } = session;
  const prisma = tenantPrisma(organizationId);

  if (!(await assertCoachActive(prisma, coachId))) return;

  const instance = await prisma.classInstance.findFirst({
    where: { id, coachId, isPrivate: true },
  });
  if (!instance) return;
  if (await isDateInValidatedWeek(organizationId, instance.date)) return;

  await prisma.classInstance.delete({ where: { id: instance.id } });

  revalidateAll();
}
