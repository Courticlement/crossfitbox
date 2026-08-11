import { prisma } from "@/lib/prisma";
import { isWeekValidated } from "@/lib/planning-lock";

// Shared data fetch backing both the shared /upload dropdown page and each
// coach's private /upload/[token] page — same week's planning, the coach's
// own submissions against it, and their private classes that week.
export async function loadCoachWeekData(coachId: string, weekStart: Date, weekEnd: Date) {
  const instances = await prisma.classInstance.findMany({
    where: { date: { gte: weekStart, lt: weekEnd } },
    include: { coach: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const mySubmissions = await prisma.classSubmission.findMany({
    where: {
      coachId,
      classInstanceId: { in: instances.map((i) => i.id) },
    },
  });
  const mySubmissionByInstance = new Map(mySubmissions.map((s) => [s.classInstanceId, s]));

  const myPrivateClasses = await prisma.classInstance.findMany({
    where: {
      coachId,
      isPrivate: true,
      date: { gte: weekStart, lt: weekEnd },
    },
    select: { id: true, date: true, startTime: true, endTime: true },
  });

  const locked = await isWeekValidated(weekStart);

  return { instances, mySubmissionByInstance, myPrivateClasses, locked };
}
