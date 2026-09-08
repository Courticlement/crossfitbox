import { tenantPrisma } from "@/lib/prisma";

export type PendingClaim = {
  id: string;
  createdAt: Date;
  coach: { name: string };
  classInstance: {
    date: Date;
    startTime: string;
    endTime: string;
    label: string;
    room: { name: string };
  };
};

// Powers the onsite "Approuver/Refuser" banner on the admin Dashboard and
// Planning pages (see PendingClaimsPanel) — every claim a coach has made on
// an unassigned class that the head coach hasn't acted on yet, oldest
// first. Not scoped to any one week, since a coach can claim a class in a
// different week than whichever one the admin currently has open.
export async function getPendingClaims(organizationId: string): Promise<PendingClaim[]> {
  return tenantPrisma(organizationId).classClaim.findMany({
    where: { status: "PENDING" },
    select: {
      id: true,
      createdAt: true,
      coach: { select: { name: true } },
      classInstance: {
        select: {
          date: true,
          startTime: true,
          endTime: true,
          label: true,
          room: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
