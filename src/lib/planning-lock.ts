import { tenantPrisma } from "@/lib/prisma";
import { startOfWeekMonday } from "@/lib/dates";

// A coach loses their own self-service edits (adding/removing a private
// class — submissions.ts, claiming an unassigned one — claims.ts) only once
// the week's PlanningWeek row has paidAt set, i.e. validateWeek has actually
// run — not merely once lockWeek has locked it ahead of time as a
// head-coach sign-off (see lib/actions/planning.ts and the PlanningWeek
// model comment in prisma/schema.prisma for the two-stage lock). The
// admin's own Planning page stays editable regardless, since that's the
// surface used to fix a validated week in the first place.
export async function isWeekValidated(organizationId: string, weekStart: Date): Promise<boolean> {
  const row = await tenantPrisma(organizationId).planningWeek.findUnique({
    where: { organizationId_weekStart: { organizationId, weekStart } },
  });
  return row !== null && row.paidAt !== null;
}

export async function isDateInValidatedWeek(organizationId: string, date: Date): Promise<boolean> {
  return isWeekValidated(organizationId, startOfWeekMonday(date));
}
