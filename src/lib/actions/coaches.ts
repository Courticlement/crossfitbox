"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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

  await prisma.coach.upsert({
    where: { name: parsed.data.name },
    update: {},
    create: { name: parsed.data.name, level: parsed.data.level || null },
  });

  revalidatePath("/admin/coaches");
  revalidatePath("/admin/planning");
  revalidatePath("/upload");
}

export async function renameCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  if (!id || !name) return;

  await prisma.coach.update({ where: { id }, data: { name, level: level || null } });
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
