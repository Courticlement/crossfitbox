import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, parseDateOnly, toDateOnly } from "@/lib/dates";

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

  const classesSheet = workbook.addWorksheet("Classes");
  classesSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Start", key: "start", width: 8 },
    { header: "End", key: "end", width: 8 },
    { header: "Room", key: "room", width: 10 },
    { header: "Label", key: "label", width: 24 },
    { header: "Type", key: "type", width: 10 },
    { header: "Coach", key: "coach", width: 18 },
    { header: "Substitute", key: "substitute", width: 18 },
    { header: "Status", key: "status", width: 12 },
  ];
  for (const inst of instances) {
    classesSheet.addRow({
      date: inst.date,
      start: inst.startTime,
      end: inst.endTime,
      room: inst.room,
      label: inst.label,
      type: inst.isPrivate ? "Private" : "Group",
      coach: inst.coach?.name ?? "",
      substitute: inst.substituteCoach?.name ?? "",
      status: inst.status,
    });
  }
  classesSheet.getColumn("date").numFmt = "yyyy-mm-dd";
  classesSheet.getRow(1).font = { bold: true };

  const submissionsSheet = workbook.addWorksheet("Self-reports");
  submissionsSheet.columns = [
    { header: "Class date", key: "classDate", width: 12 },
    { header: "Class", key: "label", width: 24 },
    { header: "Coach", key: "coach", width: 18 },
    { header: "Reported status", key: "status", width: 14 },
    { header: "Last updated (UTC)", key: "updatedAt", width: 20 },
  ];
  for (const sub of submissions) {
    submissionsSheet.addRow({
      classDate: sub.classInstance.date,
      label: sub.classInstance.label,
      coach: sub.coach.name,
      status: sub.status,
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
