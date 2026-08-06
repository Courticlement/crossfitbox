"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { addDays, formatDayLabel, parseDateOnly } from "@/lib/dates";

type DigestRow = {
  name: string;
  assigned: number;
  done: number;
  missed: number;
  planned: number;
  quota: number | null;
  overQuota: boolean;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderDigestHtml(rows: DigestRow[], weekStart: Date): string {
  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.assigned}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#0a7d32;">${r.done}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#c0392b;">${r.missed}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.planned}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.quota ?? "—"}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.overQuota ? '<strong style="color:#c0392b;">Over quota</strong>' : ""}</td>
    </tr>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;color:#111;">
      <h2>Weekly coach digest — ${escapeHtml(formatDayLabel(weekStart))} to ${escapeHtml(formatDayLabel(addDays(weekStart, 6)))}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <thead>
          <tr style="text-align:left;background:#f5f5f5;">
            <th style="padding:6px 10px;">Coach</th>
            <th style="padding:6px 10px;">Assigned</th>
            <th style="padding:6px 10px;">Done</th>
            <th style="padding:6px 10px;">Missed</th>
            <th style="padding:6px 10px;">Planned</th>
            <th style="padding:6px 10px;">Quota</th>
            <th style="padding:6px 10px;">Alert</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

export async function sendWeeklyDigest(formData: FormData) {
  const weekStartStr = String(formData.get("weekStart") ?? "");
  const weekStart = parseDateOnly(weekStartStr);
  if (!weekStart) return;
  const weekEnd = addDays(weekStart, 7);

  const [coaches, instances, quotas] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: { date: { gte: weekStart, lt: weekEnd }, coachId: { not: null } },
    }),
    prisma.coachWeeklyQuota.findMany({ where: { weekStart } }),
  ]);

  const rows: DigestRow[] = coaches.map((coach) => {
    const coachInstances = instances.filter((i) => i.coachId === coach.id);
    const assigned = coachInstances.filter((i) => i.status !== "CANCELLED").length;
    const done = coachInstances.filter((i) => i.status === "DONE").length;
    const missed = coachInstances.filter((i) => i.status === "MISSED").length;
    const planned = coachInstances.filter((i) => i.status === "PLANNED").length;
    const quota = quotas.find((q) => q.coachId === coach.id)?.maxLessons ?? null;
    const overQuota = quota !== null && assigned > quota;
    return {
      name: coach.name,
      assigned,
      done,
      missed,
      planned,
      quota,
      overQuota,
    };
  });

  const to = process.env.DIGEST_EMAIL_TO;
  const apiKey = process.env.RESEND_API_KEY;

  if (!to || !apiKey) {
    redirect(`/admin?week=${weekStartStr}&digest=error`);
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Crossfit Box <onboarding@resend.dev>",
      to,
      subject: `Coach planning digest — ${formatDayLabel(weekStart)} to ${formatDayLabel(addDays(weekStart, 6))}`,
      html: renderDigestHtml(rows, weekStart),
    });
    if (error) throw new Error(error.message);
  } catch {
    redirect(`/admin?week=${weekStartStr}&digest=error`);
  }

  redirect(`/admin?week=${weekStartStr}&digest=sent`);
}
