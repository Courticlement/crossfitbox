import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dates";

export type PendingUnavailability = {
  id: string;
  coach: { name: string };
  startDate: Date;
  endDate: Date;
  note: string | null;
};

// Powers the onsite "Got it" banner on the admin Dashboard and Planning
// pages. Only unacknowledged windows that haven't fully passed yet are
// worth surfacing — once endDate is in the past there's nothing left for
// the admin to plan around, so it just ages off instead of needing a
// manual dismiss.
export async function getPendingUnavailability(): Promise<PendingUnavailability[]> {
  const today = toDateOnly(new Date());
  return prisma.unavailability.findMany({
    where: { acknowledgedAt: null, endDate: { gte: today } },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      note: true,
      coach: { select: { name: true } },
    },
    orderBy: { startDate: "asc" },
  });
}
