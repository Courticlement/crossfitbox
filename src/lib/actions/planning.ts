"use server";

import { refresh, revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { addDays, formatDateISO, parseDateOnly } from "@/lib/dates";
import { isDateInValidatedWeek } from "@/lib/planning-lock";
import { requireOrgAdmin, requireCoachSession } from "@/lib/auth-context";

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

// A submitted roomId/coachId is client-supplied and must never be trusted
// as belonging to this organization without checking — a forged id from
// another box would otherwise let one box write into another box's data
// (or, since Coach now lives in a per-organization Postgres schema — see
// tenantPrisma in lib/prisma.ts — simply fail to resolve at all once it's
// used against the wrong organization's connection).
async function isOrgCoach(organizationId: string, coachId: string): Promise<boolean> {
  const coach = await tenantPrisma(organizationId).coach.findFirst({ where: { id: coachId } });
  return coach !== null;
}

export async function resetWeek(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
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
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const dateStr = String(formData.get("date") ?? "");
  const date = parseDateOnly(dateStr);
  if (!date) return;

  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.boxClosure.upsert({
    where: { organizationId_date: { organizationId, date } },
    create: { organizationId, date, note },
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
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const dateStr = String(formData.get("date") ?? "");
  const date = parseDateOnly(dateStr);
  if (!date) return;

  await prisma.boxClosure.deleteMany({ where: { date, organizationId } });
  await prisma.classInstance.updateMany({
    where: { date, status: "CANCELLED" },
    data: { status: "PLANNED" },
  });
  revalidateAll();
}

export async function generateWeek(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  const templates = await prisma.classTemplate.findMany({
    where: { active: true },
  });

  const closures = await prisma.boxClosure.findMany({
    where: { organizationId, date: { gte: weekStart, lt: addDays(weekStart, 7) } },
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
          roomId: tpl.roomId,
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
        roomId: tpl.roomId,
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

// Duplicates last week's classes (coach, timing, room, label, private/team
// flags) onto this week — an alternative to Generate for a week that
// shouldn't follow the standing ClassTemplate schedule, e.g. a one-off week
// that itself deviated from the templates and should just repeat as-is.
// Follows the same shape as generateWeek: closed dates are skipped, a slot
// already generated (matched here by date+startTime+room, since a copied
// instance may carry no templateId) is synced only while still PLANNED, and
// the coach is only carried over if they're not already busy that slot.
// Cancelled source classes aren't copied — cancelling wasn't a scheduling
// choice worth repeating.
export async function copyLastWeek(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  const prevWeekStart = addDays(weekStart, -7);
  const sourceInstances = await prisma.classInstance.findMany({
    where: {
      date: { gte: prevWeekStart, lt: weekStart },
      status: { not: "CANCELLED" },
    },
  });
  if (sourceInstances.length === 0) return;

  const closures = await prisma.boxClosure.findMany({
    where: { organizationId, date: { gte: weekStart, lt: addDays(weekStart, 7) } },
    select: { date: true },
  });
  const closedDates = new Set(closures.map((c) => formatDateISO(c.date)));

  const existing = await prisma.classInstance.findMany({
    where: { date: { gte: weekStart, lt: addDays(weekStart, 7) } },
  });
  const existingByDateTimeRoom = new Map(
    existing.map((e) => [`${formatDateISO(e.date)}-${e.startTime}-${e.roomId}`, e])
  );

  // Same double-booking guard as generateWeek.
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

  for (const src of sourceInstances) {
    const date = addDays(src.date, 7);
    const dateStr = formatDateISO(date);
    if (closedDates.has(dateStr)) continue; // box closed that day — nothing to copy
    const key = `${dateStr}-${src.startTime}-${src.roomId}`;
    const existingInstance = existingByDateTimeRoom.get(key);

    if (!existingInstance) {
      let coachId = src.isTeamEvent ? null : src.coachId;
      if (coachId && isBusy(coachId, dateStr, src.startTime, src.endTime)) coachId = null;

      const created = await prisma.classInstance.create({
        data: {
          templateId: src.templateId,
          date,
          startTime: src.startTime,
          endTime: src.endTime,
          label: src.label,
          roomId: src.roomId,
          isPrivate: src.isPrivate,
          isTeamEvent: src.isTeamEvent,
          coachId,
        },
      });
      existingByDateTimeRoom.set(key, created);
      if (coachId) busy.push({ coachId, date: dateStr, startTime: src.startTime, endTime: src.endTime });
      continue;
    }

    // Already present this week (e.g. a prior Generate/Copy run). Leave
    // resolved (Fait/Manqué/Annulé) classes untouched; for a still-PLANNED
    // one, sync it to last week's version — filling in the coach only if
    // it's currently unassigned, so a manual reassignment made this week
    // isn't clobbered.
    if (existingInstance.status !== "PLANNED") continue;

    let coachId = existingInstance.coachId;
    if (
      !coachId &&
      !src.isTeamEvent &&
      src.coachId &&
      !isBusy(src.coachId, dateStr, src.startTime, src.endTime)
    ) {
      coachId = src.coachId;
    }

    await prisma.classInstance.update({
      where: { id: existingInstance.id },
      data: {
        label: src.label,
        roomId: src.roomId,
        isPrivate: src.isPrivate,
        isTeamEvent: src.isTeamEvent,
        coachId,
      },
    });
    if (coachId && coachId !== existingInstance.coachId) {
      busy.push({ coachId, date: dateStr, startTime: src.startTime, endTime: src.endTime });
    }
  }

  revalidateAll();
}

// Locks the week: from this point, coaches can no longer submit or change
// self-reports for it on My Classes (see lib/planning-lock.ts). The admin's
// own edits here on the Planning page are never blocked by this.
export async function validateWeek(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  await prisma.planningWeek.upsert({
    where: { organizationId_weekStart: { organizationId, weekStart } },
    create: { organizationId, weekStart },
    update: {},
  });
  revalidateAll();
}

export async function unlockWeek(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;

  await prisma.planningWeek.deleteMany({ where: { weekStart, organizationId } });
  revalidateAll();
}

export type AssignCoachState = { error: string | null };

type ScheduleInstance = { id: string; date: Date; startTime: string; endTime: string };

// A coach can only be in one place at a time — whether they're the planned
// coach or covering as a substitute elsewhere. Returns the conflicting class
// (if any) so callers can report it, checking both roles.
async function findSchedulingConflict(
  organizationId: string,
  coachId: string,
  instance: ScheduleInstance
) {
  return tenantPrisma(organizationId).classInstance.findFirst({
    where: {
      id: { not: instance.id },
      date: instance.date,
      status: { not: "CANCELLED" },
      startTime: { lt: instance.endTime },
      endTime: { gt: instance.startTime },
      OR: [{ coachId }, { substituteCoachId: coachId }],
    },
    include: { room: { select: { name: true } } },
  });
}

export async function assignCoach(
  _prevState: AssignCoachState,
  formData: FormData
): Promise<AssignCoachState> {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const id = String(formData.get("id") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!id) return { error: null };

  const instance = await prisma.classInstance.findFirst({ where: { id } });
  if (!instance) return { error: null };
  if (coachId && !(await isOrgCoach(organizationId, coachId))) return { error: null };

  if (coachId) {
    const conflict = await findSchedulingConflict(organizationId, coachId, instance);
    if (conflict) {
      return {
        error: `Déjà assigné à « ${conflict.label} » en ${conflict.room.name} de ${conflict.startTime} à ${conflict.endTime}.`,
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

export type BulkAssignState = { error: string | null; assigned: number };

// Reassigns the coach on several classes at once (Planning grid's
// multi-select). Applies the same per-instance conflict check as assignCoach
// — sequentially, so two selected classes assigned to the same new coach
// still catch each other if their times overlap — and simply skips any
// instance that conflicts rather than failing the whole batch, reporting
// the count so the admin can see some were skipped.
export async function bulkAssignCoach(
  _prevState: BulkAssignState,
  formData: FormData
): Promise<BulkAssignState> {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const coachId = String(formData.get("coachId") ?? "").trim() || null;
  if (ids.length === 0) return { error: null, assigned: 0 };
  if (coachId && !(await isOrgCoach(organizationId, coachId))) return { error: null, assigned: 0 };

  const instances = await prisma.classInstance.findMany({
    where: { id: { in: ids } },
  });

  let assigned = 0;
  let skipped = 0;
  for (const instance of instances) {
    if (coachId) {
      const conflict = await findSchedulingConflict(organizationId, coachId, instance);
      if (conflict) {
        skipped++;
        continue;
      }
    }

    // Same orphaning safeguard as assignCoach: unassigning an already
    // resolved (DONE/MISSED) class resets it to PLANNED instead of leaving
    // it credited to nobody.
    const orphaning = !coachId && instance.status !== "PLANNED";

    await prisma.classInstance.update({
      where: { id: instance.id },
      data: {
        coachId,
        ...(orphaning ? { status: "PLANNED", substituteCoachId: null } : {}),
      },
    });
    assigned++;
  }

  revalidateAll();
  return {
    error: skipped > 0 ? `${skipped} cours ignoré(s) — coach déjà occupé à cette heure.` : null,
    assigned,
  };
}

export type BulkStatusState = { error: null; updated: number };

const CLASS_STATUS_VALUES = ["PLANNED", "DONE", "MISSED"] as const;

// Admin-only validation, bulk-only: the Planning grid's multi-select
// toolbar (see BulkAssignProvider) is the sole way to confirm a batch of
// classes Fait/Manqué — coaches no longer self-report this (see
// submissions.ts history), and there's no per-class control for it either.
// Doesn't touch coachId; who's assigned is still set separately via
// assignCoach/CoachSelect.
export async function bulkSetClassStatus(
  _prevState: BulkStatusState,
  formData: FormData
): Promise<BulkStatusState> {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const statusRaw = String(formData.get("status") ?? "");
  if (ids.length === 0 || !(CLASS_STATUS_VALUES as readonly string[]).includes(statusRaw)) {
    return { error: null, updated: 0 };
  }
  const status = statusRaw as (typeof CLASS_STATUS_VALUES)[number];

  const { count } = await prisma.classInstance.updateMany({
    where: { id: { in: ids } },
    data: {
      status,
      // A "covered by" note only makes sense while the class is Manqué —
      // clear it the moment the class is confirmed Fait or reset back to
      // Planifié, same as applyOfficial's DONE/undo handling used to.
      ...(status !== "MISSED" ? { substituteCoachId: null } : {}),
    },
  });
  revalidateAll();
  return { error: null, updated: count };
}

// Shared by both the admin's Planning page (context="admin") and a coach's
// own My Classes page — the `context` field distinguishes the two, since
// they authenticate and are scoped completely differently: only the
// coach-facing usage is blocked once the week is validated (per
// validateWeek/unlockWeek above), and only the coach-facing usage derives
// its organization from the calling coach's own session rather than an
// admin session.
export async function assignSubstitute(
  _prevState: AssignCoachState,
  formData: FormData
): Promise<AssignCoachState> {
  const id = String(formData.get("id") ?? "");
  const substituteCoachId = String(formData.get("substituteCoachId") ?? "");
  const isAdminContext = formData.get("context") === "admin";
  if (!id) return { error: null };

  let organizationId: string;
  if (isAdminContext) {
    organizationId = (await requireOrgAdmin()).organizationId;
  } else {
    const session = await requireCoachSession();
    if (!session) return { error: null };
    organizationId = session.organizationId;
  }
  const prisma = tenantPrisma(organizationId);

  const instance = await prisma.classInstance.findFirst({ where: { id } });
  if (!instance) return { error: null };

  if (!isAdminContext && (await isDateInValidatedWeek(organizationId, instance.date))) {
    return { error: "Cette semaine est validée — les déclarations sont fermées." };
  }

  if (substituteCoachId) {
    if (substituteCoachId === instance.coachId) {
      return { error: "C'est déjà le coach prévu pour ce cours." };
    }
    if (!(await isOrgCoach(organizationId, substituteCoachId))) return { error: null };

    const conflict = await findSchedulingConflict(organizationId, substituteCoachId, instance);
    if (conflict) {
      return {
        error: `Déjà assigné à « ${conflict.label} » en ${conflict.room.name} de ${conflict.startTime} à ${conflict.endTime}.`,
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

export type UpdateClassState = { error: string | null };

const TIME_RE = /^\d{2}:\d{2}$/;

// Edits a single class instance's own name/time in place — the admin's
// alternative to deleting a misconfigured class and re-adding it from
// scratch. Deliberately narrow: only label/startTime/endTime change here,
// and templateId is never touched, so this never writes back to the
// ClassTemplate this instance may have been generated from (see
// ClassInstance.templateId) — editing one week's 18h class to 18h30 doesn't
// shift every future week generated from that template.
export async function updateClassInstance(
  _prevState: UpdateClassState,
  formData: FormData
): Promise<UpdateClassState> {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  if (!id) return { error: null };

  if (!label) return { error: "Intitulé requis." };
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return { error: "Horaires invalides." };
  }
  if (endTime <= startTime) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }

  const instance = await prisma.classInstance.findFirst({ where: { id } });
  if (!instance) return { error: null };

  await prisma.classInstance.update({
    where: { id },
    data: { label, startTime, endTime },
  });
  revalidateAll();
  return { error: null };
}

export async function addAdHocClass(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const dateStr = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";
  const isTeamEvent = formData.get("isTeamEvent") === "on";
  // A team event has no single coach by definition — ignore whatever the
  // (disabled, in the UI) coach field carries rather than trust the client.
  const coachId = isTeamEvent ? null : String(formData.get("coachId") ?? "").trim() || null;
  const date = parseDateOnly(dateStr);
  if (!date || !startTime || !endTime || !label || !roomId) return;

  const room = await prisma.room.findFirst({ where: { id: roomId } });
  if (!room) return;
  if (coachId && !(await isOrgCoach(organizationId, coachId))) return;

  // A private class assigned to a coach here is being logged as already
  // delivered (mirrors the coach's own quick-add on My Classes — see
  // addPrivateClass) — mark it DONE immediately so it's reflected on that
  // coach's card (hours, private balance) right away instead of sitting
  // PLANNED until someone reports it. A class with no coach yet, or a
  // regular group class, keeps the normal PLANNED → reported flow.
  const status = isPrivate && coachId ? "DONE" : "PLANNED";

  await prisma.classInstance.create({
    data: { date, startTime, endTime, label, roomId, isPrivate, isTeamEvent, coachId, status },
  });
  revalidateAll();
}

export async function deleteClassInstance(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.classInstance.deleteMany({ where: { id } });
  revalidateAll();
}

export async function deleteClassInstances(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;

  await prisma.classInstance.deleteMany({ where: { id: { in: ids } } });
  revalidateAll();
}
