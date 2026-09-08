"use server";

import { randomBytes } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { requireCoachSession } from "@/lib/auth-context";

// Turns calendar sync on (first call) or rotates the link (any call after
// — see Coach.calendarToken's comment for why a fresh value is enough to
// revoke every link issued before it). One action serves both, since
// CalendarSyncCard's button is the same "get me a working link" request
// either way.
export async function regenerateCalendarToken() {
  const session = await requireCoachSession();
  if (!session) return;
  const { coachId, organizationId } = session;
  const prisma = tenantPrisma(organizationId);

  const token = randomBytes(24).toString("hex");
  await prisma.coach.update({ where: { id: coachId }, data: { calendarToken: token } });

  revalidatePath("/upload");
  refresh();
}
