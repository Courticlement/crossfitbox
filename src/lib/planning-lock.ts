import { prisma } from "@/lib/prisma";
import { startOfWeekMonday } from "@/lib/dates";

// A week is locked once its PlanningWeek row exists (see the admin's
// Validate/Unlock actions in lib/actions/planning.ts). Locking only affects
// coach self-reporting on My Classes — the admin's own Planning page stays
// editable regardless, since that's the surface used to fix a validated
// week in the first place.
export async function isWeekValidated(weekStart: Date): Promise<boolean> {
  const row = await prisma.planningWeek.findUnique({ where: { weekStart } });
  return row !== null;
}

export async function isDateInValidatedWeek(date: Date): Promise<boolean> {
  return isWeekValidated(startOfWeekMonday(date));
}
