import { tenantPrisma } from "@/lib/prisma";

export type PendingPrivateClassInvitation = {
  id: string;
  createdAt: Date;
};

// Powers the onsite banner on a coach's own My Classes page (/upload) —
// see PrivateClassInvitationAlert. Mirrors getPendingUnavailability in
// lib/unavailability-alerts.ts, in the other direction: there the admin
// sees what a coach flagged, here a coach sees what the admin invited them
// to do. Scoped to one coach (unlike the admin-side banner, which is
// box-wide) since this only ever renders on that coach's own page.
export async function getPendingPrivateClassInvitations(
  organizationId: string,
  coachId: string
): Promise<PendingPrivateClassInvitation[]> {
  return tenantPrisma(organizationId).privateClassInvitation.findMany({
    where: { coachId, acknowledgedAt: null },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}
