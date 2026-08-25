"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isCoachLevel } from "@/lib/coach-levels";
import { hashPassword } from "@/lib/password";
import { isCoachColor } from "@/lib/coach-colors";

function revalidateUploadPaths() {
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
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
  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = isCoachColor(colorRaw) ? colorRaw : null;
  const weeklyQuota = parseWeeklyQuota(formData);
  if (!id || !name) return;
  if (weeklyQuota !== undefined && (!Number.isInteger(weeklyQuota) || weeklyQuota < 0)) return;

  try {
    await prisma.coach.update({
      where: { id },
      data: { name, level, color, weeklyQuota: weeklyQuota ?? null },
    });
  } catch (err) {
    // The dropdown already excludes colors taken by other coaches, so this
    // only fires on a genuine race — two saves picking the same
    // just-freed/new color at the same moment. Rather than failing the
    // whole save, keep every other edit and just drop the color change.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await prisma.coach.update({
        where: { id },
        data: { name, level, weeklyQuota: weeklyQuota ?? null },
      });
    } else {
      throw err;
    }
  }
  revalidateUploadPaths();
}

export async function deleteCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.delete({ where: { id } });
  revalidateUploadPaths();
}

// Sets (or resets) a coach's /upload login password — coaches can't
// self-register, so this is how the admin hands out or rotates credentials.
export async function setCoachPassword(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 6) return;

  await prisma.coach.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
  revalidateUploadPaths();
}

// Soft-delete for a coach who no longer works at the box: keeps their id,
// name and history intact (so past classes and stats still resolve) but
// cuts off their private upload link — see assertCoachActive in
// lib/actions/submissions.ts, which every coach self-service action checks.
// Reversible via unarchiveCoach, unlike deleteCoach.
export async function archiveCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.update({ where: { id }, data: { archived: true } });
  revalidateUploadPaths();
}

export async function unarchiveCoach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.update({ where: { id }, data: { archived: false } });
  revalidateUploadPaths();
}
