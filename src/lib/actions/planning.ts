"use server";

import { refresh, revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, parseDateOnly } from "@/lib/dates";
import { isDateInValidatedWeek } from "@/lib/planning-lock";

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

// Marks a calendar day as box-closed (holiday, etc.) — not tied to any
// particular displayed week, same as Unavailability. Upserts so re-closing
// an already-closed day just updates its note. Only PLANNED classes are
// cancelled, same precedent as resetWeek: Done/Missed/Cancelled are
// resolved records and left alone.
export async function closeDay(formData: FormData) {
  const dateStr = String(formData.get("date") ?? "");
  const date = parseDateOnly(dateStr);
  if (!date) return;

  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.boxClosure.upsert({
    where: { date },
    create: { date, note },
    update: { note },
  });

  await prisma.classInstance.updateMany({
    where: { date, status: "PLANNED" },
    data: { status: "CANCELLED" },
  });

  revalidateAll();
}

// Reverses closeDay: removes the closure and restores whatever it cancelled
// back to PLANNED (safe because closeDay is currently the only thing that
// ever sets CANCELLED — a coach/admin manually cancelling a specific class
// isn't a feature that exists yet). Assigning a coach back to these is left
// to Generate/manual assignment, same as any other unassigned PLANNED slot.
export async function reopenDay(formData: FormData) {
  const dateStr = String(formData.get("date") ?? "");
  const date = parseDateOnly(dateStr);
  if (!date) return;

  await prisma.boxClosure.deleteMany({ where: { date } });
  await prisma.classInstance.updateMany({
    where: { date, status: "CANCELLED" },
    data: { status: "PLANNED" },
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

  const closures = await prisma.boxClosure.findMany({
    where: { date: { gte: weekStart, lt: addDays(weekStart, 7) } },
    select: { date: true },
  });
  const closedDates = new Set(closures.map((c) => formatDateISO(c.date)));

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
    if (closedDates.has(dateStr)) continue; // box closed that day — nothing to generate or sync
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

// Locks the week: from this point, coaches can no longer submit or change
// self-reports for it on My Classes (see lib/planning-lock.ts). The admin's
// own edits here on the Planning page are never blocked by this.
export async function validateWeek(formData: FormData) {
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  await prisma.planningWeek.upsert({
    where: { weekStart },
    create: { weekStart },
    update: {},
  });
  revalidateAll();
}

export async function unlockWeek(formData: FormData) {
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  await prisma.planningWeek.deleteMany({ where: { weekStart } });
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
        error: `Déjà assigné à « ${conflict.label} » en ${conflict.room} de ${conflict.startTime} à ${conflict.endTime}.`,
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

// Shared by both the admin's Planning page and a coach's own My Classes page
// (as part of self-reporting a missed class's cover). The `context` field
// distinguishes the two: only the coach-facing usage is blocked once the
// week is validated — the admin's own Planning page stays editable, per
// validateWeek/unlockWeek above.
export async function assignSubstitute(
  _prevState: AssignCoachState,
  formData: FormData
): Promise<AssignCoachState> {
  const id = String(formData.get("id") ?? "");
  const substituteCoachId = String(formData.get("substituteCoachId") ?? "");
  const isAdminContext = formData.get("context") === "admin";
  if (!id) return { error: null };

  const instance = await prisma.classInstance.findUnique({ where: { id } });
  if (!instance) return { error: null };

  if (!isAdminContext && (await isDateInValidatedWeek(instance.date))) {
    return { error: "Cette semaine est validée — les déclarations sont fermées." };
  }

  if (substituteCoachId) {
    if (substituteCoachId === instance.coachId) {
      return { error: "C'est déjà le coach prévu pour ce cours." };
    }

    const conflict = await findSchedulingConflict(substituteCoachId, instance);
    if (conflict) {
      return {
        error: `Déjà assigné à « ${conflict.label} » en ${conflict.room} de ${conflict.startTime} à ${conflict.endTime}.`,
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
  const coachId = String(formData.get("coachId") ?? "").trim() || null;
  const date = parseDateOnly(dateStr);
  if (!date || !startTime || !endTime || !label || !room) return;

  // A private class assigned to a coach here is being logged as already
  // delivered (mirrors the coach's own quick-add on My Classes — see
  // addPrivateClass) — mark it DONE immediately so it's reflected on that
  // coach's card (hours, private balance) right away instead of sitting
  // PLANNED until someone reports it. A class with no coach yet, or a
  // regular group class, keeps the normal PLANNED → reported flow.
  const status = isPrivate && coachId ? "DONE" : "PLANNED";

  await prisma.classInstance.create({
    data: { date, startTime, endTime, label, room, isPrivate, coachId, status },
  });
  revalidateAll();
}

export async function deleteClassInstance(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.classInstance.delete({ where: { id } });
  revalidateAll();
}

export async function deleteClassInstances(formData: FormData) {
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;

  await prisma.classInstance.deleteMany({ where: { id: { in: ids } } });
  revalidateAll();
}
