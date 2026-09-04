import { tenantPrisma } from "@/lib/prisma";
import { isWeekValidated } from "@/lib/planning-lock";

// Backs the logged-in coach's /upload page — that week's planning and their
// private classes that week. Only the coach's own classes and still-
// unassigned ones are included, not every other coach's — an unassigned
// slot stays visible so a coach can still pick it up, but another coach's
// assigned classes (and their private lessons) don't show up here.
export async function loadCoachWeekData(
  organizationId: string,
  coachId: string,
  weekStart: Date,
  weekEnd: Date
) {
  const prisma = tenantPrisma(organizationId);

  const instances = await prisma.classInstance.findMany({
    where: {
      date: { gte: weekStart, lt: weekEnd },
      OR: [{ coachId }, { coachId: null }],
    },
    include: { coach: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const myPrivateClasses = await prisma.classInstance.findMany({
    where: {
      coachId,
      isPrivate: true,
      date: { gte: weekStart, lt: weekEnd },
    },
    select: { id: true, date: true, startTime: true, endTime: true },
  });

  const locked = await isWeekValidated(organizationId, weekStart);

  return { instances, myPrivateClasses, locked };
}
