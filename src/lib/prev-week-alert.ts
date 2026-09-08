import { tenantPrisma } from "@/lib/prisma";
import { startOfWeekMonday, addDays, toDateOnly } from "@/lib/dates";

export type PrevWeekAlert = {
  show: boolean;
  prevWeekStart: Date;
  // Still-PLANNED group classes the head coach hasn't yet marked Fait or
  // Manqué (see bulkSetClassStatus) — the clearest signal there's still
  // review work left before this week can be validated.
  unreported: number;
};

// Always the most recently completed calendar week, regardless of which
// week any given admin page happens to be viewing — this is a standing
// reminder, not tied to navigation. `show` is false when that week was
// never planned at all (e.g. the box was closed) — nothing to validate,
// so no need to nag.
export async function getPrevWeekAlert(organizationId: string): Promise<PrevWeekAlert> {
  const prisma = tenantPrisma(organizationId);
  const thisWeekStart = startOfWeekMonday(toDateOnly(new Date()));
  const prevWeekStart = addDays(thisWeekStart, -7);

  const [planningWeek, instances] = await Promise.all([
    prisma.planningWeek.findUnique({
      where: { organizationId_weekStart: { organizationId, weekStart: prevWeekStart } },
    }),
    prisma.classInstance.findMany({
      where: {
        date: { gte: prevWeekStart, lt: thisWeekStart },
        status: { not: "CANCELLED" },
      },
      select: { status: true, isPrivate: true },
    }),
  ]);

  const unreported = instances.filter(
    (i) => i.status === "PLANNED" && !i.isPrivate
  ).length;

  return {
    show: planningWeek === null && instances.length > 0,
    prevWeekStart,
    unreported,
  };
}
