"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const TemplateSchema = z.object({
  dayOfWeek: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one day"),
  room: z.array(z.string().trim().min(1)).min(1, "Pick at least one room"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().trim().min(1, "Label is required"),
  isPrivate: z.coerce.boolean(),
  coachId: z.string().trim().optional(),
});

export async function createTemplate(formData: FormData) {
  const parsed = TemplateSchema.safeParse({
    dayOfWeek: formData.getAll("dayOfWeek"),
    room: formData.getAll("room"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    label: formData.get("label"),
    isPrivate: formData.get("isPrivate") === "on",
    coachId: formData.get("coachId") || undefined,
  });
  if (!parsed.success) return;

  const { dayOfWeek, room, ...rest } = parsed.data;
  const data = dayOfWeek.flatMap((day) =>
    room.map((r) => ({ ...rest, dayOfWeek: day, room: r }))
  );
  await prisma.classTemplate.createMany({ data });
  revalidatePath("/admin/templates");
}

const UpdateTemplateSchema = z.object({
  id: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  room: z.string().trim().min(1),
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
  const ids = Array.from(new Set(formData.getAll("ids").map(String)));

  await Promise.all(
    ids.map(async (id) => {
      const parsed = UpdateTemplateSchema.safeParse({
        id,
        dayOfWeek: formData.get(`dayOfWeek:${id}`),
        room: formData.get(`room:${id}`),
        startTime: formData.get(`startTime:${id}`),
        endTime: formData.get(`endTime:${id}`),
        label: formData.get(`label:${id}`),
        coachId: formData.get(`coachId:${id}`) || undefined,
      });
      if (!parsed.success) return;

      const { id: templateId, coachId, ...rest } = parsed.data;
      await prisma.classTemplate.update({
        where: { id: templateId },
        data: { ...rest, coachId: coachId || null },
      });
    })
  );

  revalidatePath("/admin/templates");
  revalidatePath("/admin/planning");
}

export async function toggleTemplateActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await prisma.classTemplate.update({
    where: { id },
    data: { active: !active },
  });
  revalidatePath("/admin/templates");
}

export async function deleteTemplate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.classTemplate.delete({ where: { id } });
  revalidatePath("/admin/templates");
}
