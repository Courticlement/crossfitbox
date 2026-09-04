"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { requireOrgAdmin } from "@/lib/auth-context";

const QuotaSchema = z.object({
  coachId: z.string().min(1),
  weekStart: z.string(),
  maxLessons: z.coerce.number().int().min(0),
});

export async function setQuota(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const parsed = QuotaSchema.safeParse({
    coachId: formData.get("coachId"),
    weekStart: formData.get("weekStart"),
    maxLessons: formData.get("maxLessons"),
  });
  if (!parsed.success) return;

  const weekStart = parseDateOnly(parsed.data.weekStart);
  if (!weekStart) return;

  // A forged coachId from another organization must never be able to set a
  // quota through this box's session — since Coach lives in this
  // organization's own schema, a foreign coachId simply won't be found.
  const coach = await prisma.coach.findFirst({
    where: { id: parsed.data.coachId },
    select: { id: true },
  });
  if (!coach) return;

  await prisma.coachWeeklyQuota.upsert({
    where: {
      coachId_weekStart: { coachId: parsed.data.coachId, weekStart },
    },
    update: { maxLessons: parsed.data.maxLessons },
    create: {
      coachId: parsed.data.coachId,
      weekStart,
      maxLessons: parsed.data.maxLessons,
    },
  });

  revalidatePath("/admin");
}
