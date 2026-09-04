"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isCoachLevel } from "@/lib/coach-levels";
import { hashPassword } from "@/lib/password";
import { isCoachColor } from "@/lib/coach-colors";
import { requireOrgAdmin } from "@/lib/auth-context";

function revalidateUploadPaths() {
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/admin/data");
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

function parseRate(formData: FormData): number | undefined {
  const raw = formData.get("rate");
  return raw === null || raw === "" ? undefined : Number(raw);
}

export async function createCoach(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const parsed = CoachSchema.safeParse({
    name: formData.get("name"),
    level: formData.get("level") || undefined,
    weeklyQuota: parseWeeklyQuota(formData),
  });
  if (!parsed.success) return;

  const level = parsed.data.level && isCoachLevel(parsed.data.level) ? parsed.data.level : null;

  await prisma.coach.upsert({
    where: { organizationId_name: { organizationId, name: parsed.data.name } },
    update: {},
    create: {
      organizationId,
      name: parsed.data.name,
      level,
      weeklyQuota: parsed.data.weeklyQuota ?? null,
    },
  });

  revalidateUploadPaths();
}

export async function renameCoach(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "").trim();
  const level = isCoachLevel(levelRaw) ? levelRaw : null;
  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = isCoachColor(colorRaw) ? colorRaw : null;
  const weeklyQuota = parseWeeklyQuota(formData);
  const rate = parseRate(formData);
  if (!id || !name) return;
  if (weeklyQuota !== undefined && (!Number.isInteger(weeklyQuota) || weeklyQuota < 0)) return;
  if (rate !== undefined && (!Number.isInteger(rate) || rate < 0)) return;

  const coach = await prisma.coach.findFirst({ where: { id }, select: { id: true } });
  if (!coach) return;

  try {
    await prisma.coach.update({
      where: { id },
      data: { name, level, color, weeklyQuota: weeklyQuota ?? null, rate: rate ?? null },
    });
  } catch (err) {
    // The dropdown already excludes colors taken by other coaches, so this
    // only fires on a genuine race — two saves picking the same
    // just-freed/new color at the same moment. Rather than failing the
    // whole save, keep every other edit and just drop the color change.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await prisma.coach.update({
        where: { id },
        data: { name, level, weeklyQuota: weeklyQuota ?? null, rate: rate ?? null },
      });
    } else {
      throw err;
    }
  }
  revalidateUploadPaths();
}

export async function deleteCoach(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.deleteMany({ where: { id } });
  revalidateUploadPaths();
}

// Sets (or resets) a coach's /upload login password — coaches can't
// self-register, so this is how the admin hands out or rotates credentials.
export async function setCoachPassword(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 6) return;

  await prisma.coach.updateMany({
    where: { id },
    data: { passwordHash: hashPassword(password) },
  });
  revalidateUploadPaths();
}

// Soft-delete for a coach who no longer works at the box: keeps their id,
// name and history intact (so past classes and stats still resolve) but
// cuts off their private upload link — see assertCoachActive in
// lib/actions/submissions.ts, which every coach self-service action checks.
// Reversible via unarchiveCoach, unlike deleteCoach.
export async function archiveCoach(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.updateMany({ where: { id }, data: { archived: true } });
  revalidateUploadPaths();
}

export async function unarchiveCoach(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.coach.updateMany({ where: { id }, data: { archived: false } });
  revalidateUploadPaths();
}

// Settles the coach's outstanding private-class balance: stamps "now" so
// computeCoachStats stops counting any private class delivered before this
// point (see privateBalancePaidAt on Coach) — the balance shown on the
// Coaches page drops to 0€ and starts accruing again from here. Also logs a
// PrivatePayment row with the settled amount, so the Paiements page can show
// proof of what was paid and when even after the running balance resets.
export async function markPrivateBalancePaid(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  if (!id || !Number.isInteger(amount) || amount <= 0) return;

  const coach = await prisma.coach.findFirst({ where: { id }, select: { id: true } });
  if (!coach) return;

  const now = new Date();
  await prisma.$transaction([
    prisma.coach.update({ where: { id }, data: { privateBalancePaidAt: now } }),
    prisma.privatePayment.create({ data: { coachId: id, amount, paidAt: now } }),
  ]);
  revalidateUploadPaths();
}

// Removes a payment record — for correcting a mistaken entry (wrong coach,
// wrong amount, double-click). Coach.privateBalancePaidAt is meant to always
// equal the coach's most recent PrivatePayment.paidAt, so this recomputes it
// from what's left rather than just leaving it stale: deleting the coach's
// latest payment reopens their balance from that point, while deleting an
// older one only removes the historical row.
export async function deletePrivatePayment(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.privatePayment.findFirst({ where: { id } });
    if (!payment) return;
    await tx.privatePayment.delete({ where: { id: payment.id } });
    const latest = await tx.privatePayment.findFirst({
      where: { coachId: payment.coachId },
      orderBy: { paidAt: "desc" },
    });
    await tx.coach.update({
      where: { id: payment.coachId },
      data: { privateBalancePaidAt: latest?.paidAt ?? null },
    });
  });
  revalidateUploadPaths();
}
