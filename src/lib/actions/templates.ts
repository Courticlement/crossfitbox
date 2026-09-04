"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/auth-context";
import type { PrismaClient } from "@/generated/prisma/client";

const TemplateSchema = z.object({
  dayOfWeek: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one day"),
  roomId: z.array(z.string().trim().min(1)).min(1, "Pick at least one room"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().trim().min(1, "Label is required"),
  isPrivate: z.coerce.boolean(),
  coachId: z.string().trim().optional(),
});

// A submitted roomId/coachId is client-supplied and must never be trusted
// without checking — a forged id from another box either fails this lookup
// (Room/Coach both live in this organization's own Postgres schema) or, in
// the worst case, is simply not found there at all.
async function orgRoomIds(db: PrismaClient): Promise<Set<string>> {
  const rooms = await db.room.findMany({ select: { id: true } });
  return new Set(rooms.map((r) => r.id));
}

async function isOrgCoach(db: PrismaClient, coachId: string): Promise<boolean> {
  const coach = await db.coach.findFirst({ where: { id: coachId } });
  return coach !== null;
}

export async function createTemplate(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const parsed = TemplateSchema.safeParse({
    dayOfWeek: formData.getAll("dayOfWeek"),
    roomId: formData.getAll("roomId"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    label: formData.get("label"),
    isPrivate: formData.get("isPrivate") === "on",
    coachId: formData.get("coachId") || undefined,
  });
  if (!parsed.success) return;
  if (parsed.data.coachId && !(await isOrgCoach(prisma, parsed.data.coachId))) return;

  const validRoomIds = await orgRoomIds(prisma);
  const { dayOfWeek, roomId, ...rest } = parsed.data;
  const rooms = roomId.filter((r) => validRoomIds.has(r));
  if (rooms.length === 0) return;

  const data = dayOfWeek.flatMap((day) => rooms.map((r) => ({ ...rest, dayOfWeek: day, roomId: r })));
  await prisma.classTemplate.createMany({ data });
  revalidatePath("/admin/templates");
}

const UpdateTemplateSchema = z.object({
  id: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  roomId: z.string().trim().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().trim().min(1, "Label is required"),
  coachId: z.string().trim().optional(),
});

// Batch save for the templates table: every row's fields live in one shared
// form (see the `ids` hidden inputs, one per row), namespaced per template
// id (`dayOfWeek:${id}`, `startTime:${id}`, ...) since a plain <form> can't
// otherwise tell which row a field belongs to. Rows that fail validation are
// skipped rather than aborting the whole save, so one bad row doesn't block
// the rest.
export async function updateTemplates(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const validRoomIds = await orgRoomIds(prisma);
  const ids = Array.from(new Set(formData.getAll("ids").map(String)));

  await Promise.all(
    ids.map(async (id) => {
      const parsed = UpdateTemplateSchema.safeParse({
        id,
        dayOfWeek: formData.get(`dayOfWeek:${id}`),
        roomId: formData.get(`roomId:${id}`),
        startTime: formData.get(`startTime:${id}`),
        endTime: formData.get(`endTime:${id}`),
        label: formData.get(`label:${id}`),
        coachId: formData.get(`coachId:${id}`) || undefined,
      });
      if (!parsed.success) return;
      if (!validRoomIds.has(parsed.data.roomId)) return;
      if (parsed.data.coachId && !(await isOrgCoach(prisma, parsed.data.coachId))) return;

      const { id: templateId, coachId, ...rest } = parsed.data;
      await prisma.classTemplate.updateMany({
        where: { id: templateId },
        data: { ...rest, coachId: coachId || null },
      });
    })
  );

  revalidatePath("/admin/templates");
  revalidatePath("/admin/planning");
}

// Unassigns the default coach from every template, active or not — a
// full reset rather than scoped to whatever filter happens to be applied to
// the table, since "reset all" is the whole recurring schedule. Doesn't
// touch anything already generated on the Planning page; that's a separate
// per-week assignment (see assignCoach in actions/planning.ts).
export async function resetAllTemplateCoaches() {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  await prisma.classTemplate.updateMany({
    data: { coachId: null },
  });
  revalidatePath("/admin/templates");
}

export type BulkAssignTemplateCoachState = { assigned: number };

// Bulk version of a single row's coach select in updateTemplates — the
// templates table's multi-select toolbar reassigns several rows' default
// coach in one submit. No scheduling-conflict check, same as the per-row
// select: a template's default coach is only ever a suggestion applied at
// generation time (see generateWeek's isBusy check in actions/planning.ts),
// not a binding commitment the way an actual ClassInstance's coach is.
export async function bulkAssignTemplateCoach(
  _prevState: BulkAssignTemplateCoachState,
  formData: FormData
): Promise<BulkAssignTemplateCoachState> {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const coachId = String(formData.get("coachId") ?? "").trim() || null;
  if (ids.length === 0) return { assigned: 0 };
  if (coachId && !(await isOrgCoach(prisma, coachId))) return { assigned: 0 };

  const { count } = await prisma.classTemplate.updateMany({
    where: { id: { in: ids } },
    data: { coachId },
  });

  revalidatePath("/admin/templates");
  return { assigned: count };
}

export async function toggleTemplateActive(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await prisma.classTemplate.updateMany({
    where: { id },
    data: { active: !active },
  });
  revalidatePath("/admin/templates");
}

export async function deleteTemplate(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.classTemplate.deleteMany({ where: { id } });
  revalidatePath("/admin/templates");
}
