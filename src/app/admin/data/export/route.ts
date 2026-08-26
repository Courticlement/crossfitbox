import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, parseDateOnly, toDateOnly } from "@/lib/dates";
import { statusLabel } from "@/lib/status-labels";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const coachIdFilter = url.searchParams.get("coachId") ?? "";
  const statusFilter = url.searchParams.get("status") ?? "";

  const today = toDateOnly(new Date());
  const from = parseDateOnly(url.searchParams.get("from") ?? "") || addDays(today, -30);
  const to = parseDateOnly(url.searchParams.get("to") ?? "") || today;
  const toExclusive = addDays(to, 1);

  const instanceWhere = {
    date: { gte: from, lt: toExclusive },
    ...(coachIdFilter === "none"
      ? { coachId: null }
      : coachIdFilter
        ? { coachId: coachIdFilter }
        : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [instances, submissions] = await Promise.all([
    prisma.classInstance.findMany({
      where: instanceWhere,
      include: { coach: true, substituteCoach: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.classSubmission.findMany({
      where: { classInstance: { date: { gte: from, lt: toExclusive } } },
      include: { coach: true, classInstance: true },
      orderBy: [{ classInstance: { date: "asc" } }, { updatedAt: "asc" }],
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Crossfit Box";
  workbook.created = new Date();

  const classesSheet = workbook.addWorksheet("Cours");
  classesSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Début", key: "start", width: 8 },
    { header: "Fin", key: "end", width: 8 },
    { header: "Salle", key: "room", width: 10 },
    { header: "Intitulé", key: "label", width: 24 },
    { header: "Type", key: "type", width: 10 },
    { header: "Coach", key: "coach", width: 18 },
    { header: "Remplaçant", key: "substitute", width: 18 },
    { header: "Statut", key: "status", width: 12 },
  ];
  for (const inst of instances) {
    classesSheet.addRow({
      date: inst.date,
      start: inst.startTime,
      end: inst.endTime,
      room: inst.room,
      label: inst.label,
      type: inst.isPrivate ? "Privé" : "Collectif",
      coach: inst.coach?.name ?? "",
      substitute: inst.substituteCoach?.name ?? "",
      status: statusLabel(inst.status),
    });
  }
  classesSheet.getColumn("date").numFmt = "yyyy-mm-dd";
  classesSheet.getRow(1).font = { bold: true };

  const submissionsSheet = workbook.addWorksheet("Déclarations");
  submissionsSheet.columns = [
    { header: "Date du cours", key: "classDate", width: 12 },
    { header: "Cours", key: "label", width: 24 },
    { header: "Coach", key: "coach", width: 18 },
    { header: "Statut déclaré", key: "status", width: 14 },
    { header: "Dernière mise à jour (UTC)", key: "updatedAt", width: 20 },
  ];
  for (const sub of submissions) {
    submissionsSheet.addRow({
      classDate: sub.classInstance.date,
      label: sub.classInstance.label,
      coach: sub.coach.name,
      status: statusLabel(sub.status),
      updatedAt: sub.updatedAt,
    });
  }
  submissionsSheet.getColumn("classDate").numFmt = "yyyy-mm-dd";
  submissionsSheet.getColumn("updatedAt").numFmt = "yyyy-mm-dd hh:mm";
  submissionsSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `crossfit-box-export-${formatDateISO(from)}-to-${formatDateISO(to)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
