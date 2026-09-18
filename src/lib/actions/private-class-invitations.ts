"use server";

import { revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { requireCoachSession, requireOrgAdmin } from "@/lib/auth-context";

function revalidateAll() {
  revalidatePath("/admin");
  revalidatePath("/upload");
}

// Admin-side: nudges one or several coaches at once to log a private class
// from their own My Classes page — see InvitePrivateClassForm's checkbox
// list — see PrivateClassForm/addPrivateClass, which this never calls
// itself, it only prompts each coach to. Skips any coach who already has an
// unacknowledged invitation, so repeat submits (or checking a coach who was
// already invited before they've dismissed it) don't pile up duplicate
// banners.
export async function invitePrivateClass(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const coachIds = [...new Set(formData.getAll("coachId").map(String).filter(Boolean))];
  if (coachIds.length === 0) return;
  const prisma = tenantPrisma(organizationId);

  const [activeCoaches, alreadyInvited] = await Promise.all([
    prisma.coach.findMany({
      where: { id: { in: coachIds }, archived: false },
      select: { id: true },
    }),
    prisma.privateClassInvitation.findMany({
      where: { coachId: { in: coachIds }, acknowledgedAt: null },
      select: { coachId: true },
    }),
  ]);
  const alreadyInvitedIds = new Set(alreadyInvited.map((i) => i.coachId));
  const toInvite = activeCoaches.filter((c) => !alreadyInvitedIds.has(c.id));
  if (toInvite.length === 0) return;

  await prisma.privateClassInvitation.createMany({
    data: toInvite.map((c) => ({ coachId: c.id })),
  });
  revalidateAll();
}

// Coach-side: dismisses one invitation off their own My Classes banner
// without deleting the underlying record — mirrors acknowledgeUnavailability
// in lib/actions/availability.ts, in the other direction. Scoped to the
// dismissing coach's own invitations, same as deleteUnavailability.
export async function acknowledgePrivateClassInvitation(formData: FormData) {
  const session = await requireCoachSession();
  if (!session) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const prisma = tenantPrisma(session.organizationId);

  await prisma.privateClassInvitation.updateMany({
    where: { id, coachId: session.coachId },
    data: { acknowledgedAt: new Date() },
  });
  revalidateAll();
}
