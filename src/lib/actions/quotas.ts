"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";

const QuotaSchema = z.object({
  coachId: z.string().min(1),
  weekStart: z.string(),
  maxLessons: z.coerce.number().int().min(0),
});

export async function setQuota(formData: FormData) {
  const parsed = QuotaSchema.safeParse({
    coachId: formData.get("coachId"),
    weekStart: formData.get("weekStart"),
    maxLessons: formData.get("maxLessons"),
  });
  if (!parsed.success) return;

  const weekStart = parseDateOnly(parsed.data.weekStart);
  if (!weekStart) return;

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
