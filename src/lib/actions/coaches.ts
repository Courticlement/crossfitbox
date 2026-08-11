"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isCoachLevel } from "@/lib/coach-levels";

function revalidateUploadPaths() {
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
  revalidatePath("/upload/[token]", "page");
}

const CoachSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  level: z.string().trim().optional(),
  weeklyQuota: z.coerce.number().int().min(0).optional(),
});

function parseWeeklyQuota(formData: FormData): number | undefined {
  const raw = formData.get("weeklyQuota");
  return raw === null || raw === "" ? undefined : Number(raw);
}

export async function createCoach(formData: FormData) {
  const parsed = CoachSchema.safeParse({
    name: formData.get("name"),
    level: formData.get("level") || undefined,
    weeklyQuota: parseWeeklyQuota(formData),
  });
  if (!parsed.success) return;

  const level = parsed.data.level && isCoachLevel(parsed.data.level) ? parsed.data.level : null;

  await prisma.coach.upsert({
    where: { name: parsed.data.name },
    update: {},
    create: { name: parsed.data.name, level, weeklyQuota: parsed.data.weeklyQuota ?? null },
  });

  revalidateUploadPaths();
}

export async function renameCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "").trim();
  const level = isCoachLevel(levelRaw) ? levelRaw : null;
  const weeklyQuota = parseWeeklyQuota(formData);
  if (!id || !name) return;
  if (weeklyQuota !== undefined && (!Number.isInteger(weeklyQuota) || weeklyQuota < 0)) return;

  await prisma.coach.update({
    where: { id },
    data: { name, level, weeklyQuota: weeklyQuota ?? null },
  });
  revalidateUploadPaths();
}

export async function deleteCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.delete({ where: { id } });
  revalidateUploadPaths();
}

// Issues a fresh access token, invalidating the coach's current private
// upload link — use this if a link ever leaks or the wrong person got it.
export async function regenerateCoachAccessToken(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.update({ where: { id }, data: { accessToken: randomUUID() } });
  revalidateUploadPaths();
}
