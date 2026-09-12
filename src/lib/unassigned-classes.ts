import { tenantPrisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dates";

export type UnassignedClass = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
  room: { name: string };
};

// Powers the "needs a coach" banner on the admin Dashboard and Planning
// pages — upcoming group classes (never a team event or a private class,
// see ClassInstance.isTeamEvent/isPrivate) that still have no coachId.
// Scoped to today onward: a past unassigned class is a payroll problem for
// validateWeek to catch (see prev-week-alert.ts), not something anyone can
// still staff.
export async function getUnassignedClasses(organizationId: string): Promise<UnassignedClass[]> {
  const today = toDateOnly(new Date());
  return tenantPrisma(organizationId).classInstance.findMany({
    where: {
      date: { gte: today },
      status: { not: "CANCELLED" },
      isTeamEvent: false,
      isPrivate: false,
      coachId: null,
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      label: true,
      room: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}
