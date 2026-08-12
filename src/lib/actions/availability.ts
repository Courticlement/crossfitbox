"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, formatDayLabel } from "@/lib/dates";

function revalidateAll() {
  revalidatePath("/admin");
  revalidatePath("/admin/planning");
  revalidatePath("/upload");
  revalidatePath("/upload/[token]", "page");
}

// Mirrors the guard in lib/actions/submissions.ts — an archived coach's
// bookmarked link shouldn't be able to flag time off any more than it can
// report a class.
async function assertCoachActive(coachId: string): Promise<boolean> {
  const coach = await prisma.coach.findUnique({ where: { id: coachId }, select: { archived: true } });
  return coach !== null && !coach.archived;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatRange(startDate: Date, endDate: Date): string {
  return startDate.getTime() === endDate.getTime()
    ? formatDayLabel(startDate)
    : `${formatDayLabel(startDate)} – ${formatDayLabel(endDate)}`;
}

// Best-effort: a coach's submission is already saved (and shows up on the
// onsite banner) regardless of whether this succeeds, so a missing/invalid
// Resend config or a send failure is swallowed rather than surfaced.
async function emailAdminUnavailability(
  coachName: string,
  startDate: Date,
  endDate: Date,
  note: string | null
) {
  const to = process.env.DIGEST_EMAIL_TO;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) return;

  const range = formatRange(startDate, endDate);

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Crossfit Box <onboarding@resend.dev>",
      to,
      subject: `${coachName} flagged time off — ${range}`,
      html: `
        <div style="font-family:sans-serif;color:#111;">
          <p><strong>${escapeHtml(coachName)}</strong> won't be able to coach ${escapeHtml(range)}.</p>
          ${note ? `<p>Note: ${escapeHtml(note)}</p>` : ""}
        </div>
      `,
    });
  } catch {
    // See comment above — nothing to do here.
  }
}

const UnavailabilitySchema = z.object({
  coachId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(280).optional(),
});

// Coach self-service: flags a date range they can't coach. Fires the admin
// email immediately and the record itself powers the onsite banner (see
// getPendingUnavailability) until an admin acknowledges it.
export async function submitUnavailability(formData: FormData) {
  const parsed = UnavailabilitySchema.safeParse({
    coachId: formData.get("coachId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return;

  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = parseDateOnly(parsed.data.endDate);
  if (!startDate || !endDate || endDate < startDate) return;

  const coach = await prisma.coach.findUnique({ where: { id: parsed.data.coachId } });
  if (!coach || coach.archived) return;

  const note = parsed.data.note || null;

  await prisma.unavailability.create({
    data: { coachId: coach.id, startDate, endDate, note },
  });

  await emailAdminUnavailability(coach.name, startDate, endDate, note);

  revalidateAll();
}

// Scoped to the reporting coach's own entries, same ownership pattern as
// deletePrivateClass — a forged coachId just fails to match any row.
export async function deleteUnavailability(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!id || !coachId) return;
  if (!(await assertCoachActive(coachId))) return;

  await prisma.unavailability.deleteMany({ where: { id, coachId } });
  revalidateAll();
}

// Admin-side: dismisses one entry off the onsite banner without deleting
// the underlying record, so there's still a history of who flagged what.
export async function acknowledgeUnavailability(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.unavailability.update({
    where: { id },
    data: { acknowledgedAt: new Date() },
  });
  revalidateAll();
}
