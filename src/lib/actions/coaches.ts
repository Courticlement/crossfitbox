"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isCoachLevel } from "@/lib/coach-levels";

const CoachSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  level: z.string().trim().optional(),
});

export async function createCoach(formData: FormData) {
  const parsed = CoachSchema.safeParse({
    name: formData.get("name"),
    level: formData.get("level") || undefined,
  });
  if (!parsed.success) return;

  const level = parsed.data.level && isCoachLevel(parsed.data.level) ? parsed.data.level : null;

  await prisma.coach.upsert({
    where: { name: parsed.data.name },
    update: {},
    create: { name: parsed.data.name, level },
  });

  revalidatePath("/admin/coaches");
  revalidatePath("/admin/planning");
  revalidatePath("/upload");
}

export async function renameCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "").trim();
  const level = isCoachLevel(levelRaw) ? levelRaw : null;
  if (!id || !name) return;

  await prisma.coach.update({ where: { id }, data: { name, level } });
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
}

export async function deleteCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.delete({ where: { id } });
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
}
