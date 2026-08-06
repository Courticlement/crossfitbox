"use server";

import { refresh, revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, parseDateOnly } from "@/lib/dates";

function revalidateAll() {
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
  revalidatePath("/upload");
  // Reassigning a coach affects more than the dropdown that was touched —
  // conflict panels, the missed-classes list, and other rows on the same
  // page all derive from the same data. refresh() makes sure this route's
  // RSC payload is re-fetched in the same response instead of requiring a
  // manual page reload to see those knock-on changes.
  refresh();
}

export async function resetWeek(formData: FormData) {
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  // Only PLANNED classes are removed — anything already Done, Missed, or
  // Cancelled is a resolved historical record and is left alone.
  await prisma.classInstance.deleteMany({
    where: {
      date: { gte: weekStart, lt: addDays(weekStart, 7) },
      status: "PLANNED",
    },
  });
  revalidateAll();
}

export async function generateWeek(formData: FormData) {
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  const templates = await prisma.classTemplate.findMany({
    where: { active: true },
  });

  const existing = await prisma.classInstance.findMany({
    where: { date: { gte: weekStart, lt: addDays(weekStart, 7) } },
  });
  const existingByTemplateDate = new Map(
    existing
      .filter((e) => e.templateId)
      .map((e) => [`${e.templateId}-${formatDateISO(e.date)}`, e])
  );

  // Track coach commitments (this week's existing classes + whatever we
  // assign during this run) so two slots don't double-book the same coach —
  // the later one is left unassigned instead, same as a rejected manual
  // assignment would be.
  const busy = existing
    .filter((e) => e.coachId)
    .map((e) => ({
      coachId: e.coachId as string,
      date: formatDateISO(e.date),
      startTime: e.startTime,
      endTime: e.endTime,
    }));
  const isBusy = (coachId: string, date: string, startTime: string, endTime: string) =>
    busy.some(
      (b) =>
        b.coachId === coachId &&
        b.date === date &&
        b.startTime < endTime &&
        b.endTime > startTime
    );

  for (const tpl of templates) {
    const date = addDays(weekStart, tpl.dayOfWeek - 1);
    const dateStr = formatDateISO(date);
    const existingInstance = existingByTemplateDate.get(`${tpl.id}-${dateStr}`);

    if (!existingInstance) {
      let coachId = tpl.coachId;
      if (coachId && isBusy(coachId, dateStr, tpl.startTime, tpl.endTime)) coachId = null;

      await prisma.classInstance.create({
        data: {
          templateId: tpl.id,
          date,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          label: tpl.label,
          room: tpl.room,
          isPrivate: tpl.isPrivate,
          coachId,
        },
      });
      if (coachId) busy.push({ coachId, date: dateStr, startTime: tpl.startTime, endTime: tpl.endTime });
      continue;
    }

    // Already generated for this slot. Keep already-happened/resolved
    // classes untouched; for a still-PLANNED class, sync its time/label/room
    // from the (possibly since-edited) template. Only fill in the coach if
    // it's currently unassigned — a manual reassignment is left alone.
    if (existingInstance.status !== "PLANNED") continue;

    let coachId = existingInstance.coachId;
    if (!coachId && tpl.coachId && !isBusy(tpl.coachId, dateStr, tpl.startTime, tpl.endTime)) {
      coachId = tpl.coachId;
    }

    await prisma.classInstance.update({
      where: { id: existingInstance.id },
      data: {
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        label: tpl.label,
        room: tpl.room,
        isPrivate: tpl.isPrivate,
        coachId,
      },
    });
    if (coachId && coachId !== existingInstance.coachId) {
      busy.push({ coachId, date: dateStr, startTime: tpl.startTime, endTime: tpl.endTime });
    }
  }

  revalidateAll();
}

export type AssignCoachState = { error: string | null };

type ScheduleInstance = { id: string; date: Date; startTime: string; endTime: string };

// A coach can only be in one place at a time — whether they're the planned
// coach or covering as a substitute elsewhere. Returns the conflicting class
// (if any) so callers can report it, checking both roles.
async function findSchedulingConflict(coachId: string, instance: ScheduleInstance) {
  return prisma.classInstance.findFirst({
    where: {
      id: { not: instance.id },
      date: instance.date,
      status: { not: "CANCELLED" },
      startTime: { lt: instance.endTime },
      endTime: { gt: instance.startTime },
      OR: [{ coachId }, { substituteCoachId: coachId }],
    },
  });
}

export async function assignCoach(
  _prevState: AssignCoachState,
  formData: FormData
): Promise<AssignCoachState> {
  const id = String(formData.get("id") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!id) return { error: null };

  const instance = await prisma.classInstance.findUnique({ where: { id } });
  if (!instance) return { error: null };

  if (coachId) {
    const conflict = await findSchedulingConflict(coachId, instance);
    if (conflict) {
      return {
        error: `Already assigned to "${conflict.label}" in ${conflict.room} at ${conflict.startTime}–${conflict.endTime}.`,
      };
    }
  }

  // Unassigning a class that's already been reported DONE/MISSED would
  // otherwise leave it credited to nobody while still showing as
  // resolved — the coach's hours would silently drop out of the salary
  // numbers. Reset it to PLANNED instead, so it's clearly open again
  // rather than a done-but-orphaned record.
  const orphaning = !coachId && instance.status !== "PLANNED";

  await prisma.classInstance.update({
    where: { id },
    data: {
      coachId: coachId || null,
      ...(orphaning ? { status: "PLANNED", substituteCoachId: null } : {}),
    },
  });
  revalidateAll();
  return { error: null };
}

export async function assignSubstitute(
  _prevState: AssignCoachState,
  formData: FormData
): Promise<AssignCoachState> {
  const id = String(formData.get("id") ?? "");
  const substituteCoachId = String(formData.get("substituteCoachId") ?? "");
  if (!id) return { error: null };

  if (substituteCoachId) {
    const instance = await prisma.classInstance.findUnique({ where: { id } });
    if (!instance) return { error: null };

    if (substituteCoachId === instance.coachId) {
      return { error: "That's already the planned coach for this class." };
    }

    const conflict = await findSchedulingConflict(substituteCoachId, instance);
    if (conflict) {
      return {
        error: `Already assigned to "${conflict.label}" in ${conflict.room} at ${conflict.startTime}–${conflict.endTime}.`,
      };
    }
  }

  await prisma.classInstance.update({
    where: { id },
    data: { substituteCoachId: substituteCoachId || null },
  });
  revalidateAll();
  return { error: null };
}

export async function addAdHocClass(formData: FormData) {
  const dateStr = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const room = String(formData.get("room") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";
  const date = parseDateOnly(dateStr);
  if (!date || !startTime || !endTime || !label || !room) return;

  await prisma.classInstance.create({
    data: { date, startTime, endTime, label, room, isPrivate },
  });
  revalidateAll();
}

export async function deleteClassInstance(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.classInstance.delete({ where: { id } });
  revalidateAll();
}
