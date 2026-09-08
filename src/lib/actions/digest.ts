"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { prisma, tenantPrisma } from "@/lib/prisma";
import { addDays, formatDayLabel, isoWeekday, parseDateOnly } from "@/lib/dates";
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
// the week dashboard (see week-dashboard.tsx) — same columns, same numbers.
function renderDigestHtml(rows: DigestRow[], weekStart: Date): string {
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
      <h2>Récapitulatif hebdomadaire des coachs — ${escapeHtml(formatDayLabel(weekStart))} au ${escapeHtml(formatDayLabel(addDays(weekStart, 6)))}</h2>
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

  // Every admin who can actually act on this — ADMIN and SUPERADMIN for
  // this box — rather than one fixed inbox someone has to keep updated by
  // hand. Admin lives in the control-plane schema, not this org's tenant
  // schema (see Organization's comment in prisma/schema.prisma), so this
  // is the shared `prisma` client, not `tenant`.
  const admins = await prisma.admin.findMany({
    where: { organizationId, archived: false, role: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { email: true },
  });
  const to = admins.map((a) => a.email);
  const apiKey = process.env.RESEND_API_KEY;

  if (to.length === 0 || !apiKey) {
    redirect(`/admin?week=${weekStartStr}&digest=error`);
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Crossfit Box <onboarding@resend.dev>",
      to,
      subject: `Récapitulatif du planning coachs — ${formatDayLabel(weekStart)} au ${formatDayLabel(addDays(weekStart, 6))}`,
      html: renderDigestHtml(rows, weekStart),
    });
    if (error) throw new Error(error.message);
  } catch {
    redirect(`/admin?week=${weekStartStr}&digest=error`);
  }

  redirect(`/admin?week=${weekStartStr}&digest=sent`);
}
