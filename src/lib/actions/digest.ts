"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { prisma, tenantPrisma } from "@/lib/prisma";
import {
  addDays,
  addMonths,
  formatDateISO,
  formatDayLabel,
  formatMonthLabel,
  isoWeekday,
  parseDateOnly,
  parseMonthOnly,
  startOfMonth,
  startOfWeekMonday,
} from "@/lib/dates";
import { classDurationHours } from "@/lib/coach-stats";
import { groupClassRate, PRIVATE_CLASS_COST_EUR } from "@/lib/coach-levels";
import { requireOrgAdmin } from "@/lib/auth-context";

type DigestRow = {
  name: string;
  totalHours: number;
  heuresFixes: number;
  reviewCount: number;
  privateDone: number;
  netAmount: number;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Mirrors the Coach/Heure total/Heures fixes/Review/Privés/Net € table on
// the dashboard (see week-dashboard.tsx and month-dashboard.tsx) — same
// columns, same numbers, whichever period the rows were computed over.
function renderDigestHtml(rows: DigestRow[], periodLabel: string): string {
  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.totalHours.toFixed(1)}h</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.heuresFixes.toFixed(1)}h</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.reviewCount}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.privateDone}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${r.netAmount < 0 ? "#c0392b" : "#0a7d32"};">${r.netAmount}€</td>
    </tr>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;color:#111;">
      <h2>Récapitulatif des coachs — ${escapeHtml(periodLabel)}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <thead>
          <tr style="text-align:left;background:#f5f5f5;">
            <th style="padding:6px 10px;">Coach</th>
            <th style="padding:6px 10px;">Heure total</th>
            <th style="padding:6px 10px;">Heures fixes</th>
            <th style="padding:6px 10px;">Review</th>
            <th style="padding:6px 10px;">Privés</th>
            <th style="padding:6px 10px;">Net €</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

// Every admin who can actually act on this — ADMIN and SUPERADMIN for this
// box — rather than one fixed inbox someone has to keep updated by hand.
// Admin lives in the control-plane schema, not this org's tenant schema
// (see Organization's comment in prisma/schema.prisma), so this is the
// shared `prisma` client, not `tenant`.
async function digestRecipients(organizationId: string): Promise<string[]> {
  const admins = await prisma.admin.findMany({
    where: { organizationId, archived: false, role: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

// "No recipients" and "provider rejected the send" used to collapse into
// one generic error — e.g. Resend's sandbox mode refusing every recipient
// but the account owner reads identically to "nobody to send to" unless
// the caller can tell them apart. `detail` carries the provider's own
// message (short, safe to show — Resend's rejection reasons are generic
// account-config text, never anything about a specific person) so the
// admin sees exactly what to fix instead of a dead end.
type DigestSendResult =
  | { ok: true }
  | { ok: false; reason: "no_recipients" | "no_api_key" | "send_failed"; detail?: string };

async function sendDigestToAdmins(
  organizationId: string,
  subject: string,
  rows: DigestRow[],
  periodLabel: string
): Promise<DigestSendResult> {
  const to = await digestRecipients(organizationId);
  if (to.length === 0) return { ok: false, reason: "no_recipients" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Crossfit Box <onboarding@resend.dev>",
      to,
      subject,
      html: renderDigestHtml(rows, periodLabel),
    });
    if (error) return { ok: false, reason: "send_failed", detail: error.message };
  } catch (err) {
    return { ok: false, reason: "send_failed", detail: err instanceof Error ? err.message : undefined };
  }
  return { ok: true };
}

// Builds the redirect query string for a failed send — same shape from
// both actions, just onto a different base (week vs month view).
function digestErrorParams(result: Extract<DigestSendResult, { ok: false }>): string {
  const params = new URLSearchParams({ digest: "error", reason: result.reason });
  if (result.detail) params.set("detail", result.detail);
  return params.toString();
}

export async function sendWeeklyDigest(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const tenant = tenantPrisma(organizationId);
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;
  const weekEnd = addDays(weekStart, 7);

  const [coaches, instances, planningWeek, weekReviews] = await Promise.all([
    tenant.coach.findMany({ orderBy: { name: "asc" } }),
    tenant.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd }, coachId: { not: null } },
    }),
    tenant.planningWeek.findUnique({ where: { organizationId_weekStart: { organizationId, weekStart } } }),
    tenant.classReview.findMany({
      where: { classInstance: { date: { gte: weekStart, lt: weekEnd } } },
      select: { id: true, classInstance: { select: { coachId: true } } },
    }),
  ]);
  const weekValidated = planningWeek !== null;

  const rows: DigestRow[] = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    // Same "all non-cancelled classes" basis as the dashboard's hours
    // columns — includes still-PLANNED classes, not just delivered ones.
    const activeCoachInstances = coachInstances.filter((i) => i.status !== "CANCELLED");
    const totalHours = activeCoachInstances.reduce(
      (sum, i) => sum + classDurationHours(i.startTime, i.endTime),
      0
    );
    const heuresFixes = activeCoachInstances
      .filter((i) => isoWeekday(i.date) <= 5)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    const done = coachInstances.filter((i) => i.status === "DONE" && !i.isPrivate).length;
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = weekReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    const groupAmount = weekValidated ? done * groupClassRate(coach.level) : 0;
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
    return { name: coach.name, totalHours, heuresFixes, reviewCount, privateDone, netAmount };
  });

  const periodLabel = `${formatDayLabel(weekStart)} au ${formatDayLabel(addDays(weekStart, 6))}`;
  const result = await sendDigestToAdmins(
    organizationId,
    `Récapitulatif du planning coachs — ${periodLabel}`,
    rows,
    periodLabel
  );

  if (!result.ok) redirect(`/admin?week=${weekStartStr}&${digestErrorParams(result)}`);
  redirect(`/admin?week=${weekStartStr}&digest=sent`);
}

export async function sendMonthlyDigest(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const tenant = tenantPrisma(organizationId);
  const monthStartStr = String(formData.get("monthStart") ?? "");
  const requestedMonth = parseMonthOnly(monthStartStr);
  if (!requestedMonth) return;
  const monthStart = startOfMonth(requestedMonth);
  const monthEnd = addMonths(monthStart, 1);

  const [coaches, instances, planningWeeks, monthReviews] = await Promise.all([
    tenant.coach.findMany({ orderBy: { name: "asc" } }),
    tenant.classInstance.findMany({
      where: { date: { gte: monthStart, lt: monthEnd }, coachId: { not: null } },
    }),
    // A calendar month's edge weeks can straddle the month boundary — same
    // reasoning as month-dashboard.tsx's own validatedWeekStarts.
    tenant.planningWeek.findMany({ select: { weekStart: true } }),
    tenant.classReview.findMany({
      where: { classInstance: { date: { gte: monthStart, lt: monthEnd } } },
      select: { id: true, classInstance: { select: { coachId: true } } },
    }),
  ]);
  const validatedWeekStarts = new Set(planningWeeks.map((w) => formatDateISO(w.weekStart)));

  const rows: DigestRow[] = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    const activeCoachInstances = coachInstances.filter((i) => i.status !== "CANCELLED");
    const totalHours = activeCoachInstances.reduce(
      (sum, i) => sum + classDurationHours(i.startTime, i.endTime),
      0
    );
    const heuresFixes = activeCoachInstances
      .filter((i) => isoWeekday(i.date) <= 5)
      .reduce((sum, i) => sum + classDurationHours(i.startTime, i.endTime), 0);
    const done = coachInstances.filter((i) => i.status === "DONE" && !i.isPrivate);
    const privateDone = coachInstances.filter((i) => i.status === "DONE" && i.isPrivate).length;
    const reviewCount = monthReviews.filter((r) => r.classInstance.coachId === coach.id).length;
    // Each DONE group class only pays out if the admin validated *its own*
    // week — a month can mix validated and not-yet-validated weeks, so
    // this is checked per class, not per month (same as month-dashboard.tsx).
    const rate = groupClassRate(coach.level);
    const groupAmount = done.reduce((sum, inst) => {
      const weekStartStr = formatDateISO(startOfWeekMonday(inst.date));
      return validatedWeekStarts.has(weekStartStr) ? sum + rate : sum;
    }, 0);
    const privateCost = privateDone * PRIVATE_CLASS_COST_EUR;
    const netAmount = groupAmount - privateCost;
    return { name: coach.name, totalHours, heuresFixes, reviewCount, privateDone, netAmount };
  });

  const periodLabel = formatMonthLabel(monthStart);
  const result = await sendDigestToAdmins(
    organizationId,
    `Récapitulatif du planning coachs — ${periodLabel}`,
    rows,
    periodLabel
  );

  if (!result.ok) redirect(`/admin?view=month&month=${monthStartStr}&${digestErrorParams(result)}`);
  redirect(`/admin?view=month&month=${monthStartStr}&digest=sent`);
}
