"use server";

import { refresh, revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { isDateInValidatedWeek } from "@/lib/planning-lock";
import { requireCoachSession, requireOrgAdmin } from "@/lib/auth-context";
import { findSchedulingConflict } from "@/lib/actions/planning";

function revalidateAll() {
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
  refresh();
}

export type ClaimState = { error: string | null };

// A coach claiming an unassigned class from their own My Classes view —
// doesn't assign the class outright, just records the request as PENDING.
// The head coach still has to approve it (see approveClaim below) before
// the class actually shows up as theirs — an unchecked coach-side write
// straight onto a class's official coachId is exactly what coaches losing
// self-report privileges (see validateWeek's comment in actions/planning.ts)
// was about.
// Re-claiming after a rejection is allowed (the upsert just flips the same
// row back to PENDING) since only one row ever exists per
// (classInstanceId, coachId) pair.
export async function claimClass(
  _prevState: ClaimState,
  formData: FormData
): Promise<ClaimState> {
  const session = await requireCoachSession();
  if (!session) return { error: null };
  const { coachId, organizationId } = session;
  const prisma = tenantPrisma(organizationId);

  const classInstanceId = String(formData.get("classInstanceId") ?? "");
  if (!classInstanceId) return { error: null };

  const instance = await prisma.classInstance.findFirst({ where: { id: classInstanceId } });
  if (!instance) return { error: null };
  // Only an actually up-for-grabs class can be claimed — already assigned,
  // a team event (nobody is ever assigned to those by design), or cancelled
  // classes all fail silently rather than erroring, since none of these are
  // reachable through the claim button itself (it only renders when none of
  // this applies) and could only happen via a stale page or a replayed
  // request.
  if (instance.coachId || instance.isTeamEvent || instance.status === "CANCELLED") {
    return { error: null };
  }
  if (await isDateInValidatedWeek(organizationId, instance.date)) {
    return { error: "Cette semaine est validée — impossible de réclamer ce cours." };
  }

  await prisma.classClaim.upsert({
    where: { classInstanceId_coachId: { classInstanceId, coachId } },
    update: { status: "PENDING", resolvedAt: null },
    create: { classInstanceId, coachId, status: "PENDING" },
  });

  revalidateAll();
  return { error: null };
}

// A coach withdrawing their own still-pending claim — lets them undo an
// accidental click without waiting on the head coach to reject it.
export async function withdrawClaim(formData: FormData) {
  const session = await requireCoachSession();
  if (!session) return;
  const { coachId } = session;
  const prisma = tenantPrisma(session.organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.classClaim.deleteMany({ where: { id, coachId, status: "PENDING" } });
  revalidateAll();
}

// The head coach approving a pending claim: assigns the class to the
// claiming coach — same scheduling-conflict check as assignCoach, since
// approving a claim shouldn't double-book someone who's picked up another
// class in the meantime — and settles every other pending claim on the same
// class as rejected, since it's no longer up for grabs.
export async function approveClaim(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const claim = await prisma.classClaim.findFirst({ where: { id, status: "PENDING" } });
  if (!claim) return;

  const instance = await prisma.classInstance.findFirst({ where: { id: claim.classInstanceId } });
  if (!instance) return;

  // The class may have been assigned another way since the claim was made
  // (the admin picked someone directly, or a different claim on it was
  // already approved) — reject this one instead of silently overwriting
  // whoever's there now.
  if (instance.coachId) {
    await prisma.classClaim.update({
      where: { id: claim.id },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });
    revalidateAll();
    return;
  }

  const conflict = await findSchedulingConflict(organizationId, claim.coachId, instance);
  if (conflict) {
    // Leave it pending — the admin sees on the Planning grid that this
    // coach is unavailable at that time and can revisit once it's freed up,
    // rather than the claim silently disappearing.
    return;
  }

  await prisma.$transaction([
    prisma.classInstance.update({ where: { id: instance.id }, data: { coachId: claim.coachId } }),
    prisma.classClaim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", resolvedAt: new Date() },
    }),
    prisma.classClaim.updateMany({
      where: { classInstanceId: instance.id, id: { not: claim.id }, status: "PENDING" },
      data: { status: "REJECTED", resolvedAt: new Date() },
    }),
  ]);

  revalidateAll();
}

// The head coach declining a pending claim — the class stays unassigned,
// open to another coach (or the same one again later, via a fresh claim —
// see the upsert in claimClass).
export async function rejectClaim(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.classClaim.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", resolvedAt: new Date() },
  });
  revalidateAll();
}
