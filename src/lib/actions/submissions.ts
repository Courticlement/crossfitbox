"use server";

import { z } from "zod";
import { refresh, revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { addDays, parseDateOnly } from "@/lib/dates";
import { groupClassRate } from "@/lib/coach-levels";
import { requireCoachSession, requireOrgAdmin } from "@/lib/auth-context";

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
// the class back to an unreported PLANNED state. Only reachable now via the
// admin's conflict-resolution actions below (useSubmission/dismissSubmission)
// — coaches no longer self-report; going forward a class only becomes Fait
// via validateWeek ("Valider le planning") in actions/planning.ts.
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
      data: { status: "PLANNED", substituteCoachId: null, paidRate: null },
    });
    return;
  }

  // A DONE report is stamped with its coach's current rate (see
  // markInstancesDone in actions/planning.ts) — so a later change to
  // Coach.rate never retroactively changes pay already validated this way.
  let paidRate: number | null = null;
  if (submission.status === "DONE") {
    const coach = await db.coach.findUnique({
      where: { id: submission.coachId },
      select: { rate: true, level: true },
    });
    paidRate = coach ? (coach.rate ?? groupClassRate(coach.level)) : null;
  }

  await db.classInstance.update({
    where: { id: classInstanceId },
    data: {
      status: submission.status,
      coachId: submission.status === "DONE" ? submission.coachId : instance.coachId,
      substituteCoachId: submission.status === "DONE" ? null : instance.substituteCoachId,
      paidRate,
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
    athleteName: z.string().trim().min(1),
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
// Deliberately allowed regardless of the week's lock/validate state — a
// private lesson can come up (or get logged late) any time, unlike group
// classes, and unlike a group class there's no matching admin-side record
// this could conflict with. A coach can no longer delete one once added
// (see the removed deletePrivateClass) — get an admin to fix a mistake.
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
    athleteName: formData.get("athleteName"),
  });
  if (!parsed.success) return;

  const { weekStart, dayOfWeek, startTime, endTime, athleteName } = parsed.data;
  const athleteIsMember = formData.get("athleteIsMember") === "on";

  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach || coach.archived) return;

  const weekStartDate = parseDateOnly(weekStart);
  if (!weekStartDate) return;

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
      athleteName,
      athleteIsMember,
      status: "DONE",
      coachId,
    },
  });

  revalidateAll();
}
