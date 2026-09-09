import { tenantPrisma } from "@/lib/prisma";
import { startOfWeekMonday } from "@/lib/dates";

// A week is locked once its PlanningWeek row exists (see the admin's
// Validate/Unlock actions in lib/actions/planning.ts, which move group
// class pay together with this lock in both directions — see
// coach-stats.ts). This gate itself is only about a coach's own edits on My
// Classes — adding/removing a private class (submissions.ts) or claiming an
// unassigned one (claims.ts). The admin's own Planning page stays editable
// regardless, since that's the surface used to fix a validated week in the
// first place.
export async function isWeekValidated(organizationId: string, weekStart: Date): Promise<boolean> {
  const row = await tenantPrisma(organizationId).planningWeek.findUnique({
    where: { organizationId_weekStart: { organizationId, weekStart } },
  });
  return row !== null;
}

export async function isDateInValidatedWeek(organizationId: string, date: Date): Promise<boolean> {
  return isWeekValidated(organizationId, startOfWeekMonday(date));
}
