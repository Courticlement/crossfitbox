import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import type { DigestRow } from "@/lib/digest-rows";
import { pastilleColor } from "@/lib/review-constants";

// A4 portrait, points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const ROW_HEIGHT = 20;

// Same total width as before (515pt) — Coach and Heures fixes each gave up
// a little room so Review (now count + pastille dots, see drawReviewCell)
// has space without pushing the table past the page margins.
const COLUMNS: { label: string; width: number }[] = [
  { label: "Coach", width: 150 },
  { label: "Heure total", width: 80 },
  { label: "Heures fixes", width: 70 },
  { label: "Review", width: 95 },
  { label: "Privés", width: 65 },
  { label: "Net €", width: 55 },
];
const REVIEW_COLUMN_INDEX = 3;

function cellsFor(row: DigestRow | { name: string; totalHours: number; heuresFixes: number; reviewCount: number; privateDone: number; netAmount: number }): string[] {
  return [
    row.name,
    `${row.totalHours.toFixed(1)}h`,
    `${row.heuresFixes.toFixed(1)}h`,
    String(row.reviewCount),
    String(row.privateDone),
    `${row.netAmount}€`,
  ];
}

function hexToColor(hex: string): Color {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

const tableWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);

// Renders the same Coach/Heure total/Heures fixes/Review/Privés/Net € table
// as the dashboard (see week-dashboard.tsx and month-dashboard.tsx) as a
// downloadable PDF — replaces the old e-mail digest.
export async function renderDigestPdf(rows: DigestRow[], title: string, periodLabel: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${title} — ${periodLabel}`);
  doc.setCreator("Crossfit Box");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawHeading = () => {
    page.drawText(title, { x: MARGIN, y, size: 16, font: boldFont, color: rgb(0.07, 0.07, 0.07) });
    y -= 20;
    page.drawText(periodLabel, { x: MARGIN, y, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 26;
  };

  const drawTableHeader = () => {
    let x = MARGIN;
    for (const col of COLUMNS) {
      page.drawText(col.label, { x, y, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      x += col.width;
    }
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + tableWidth, y },
      thickness: 0.75,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;
  };

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawTableHeader();
  };

  drawHeading();
  drawTableHeader();

  const totals = rows.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.totalHours,
      heuresFixes: acc.heuresFixes + r.heuresFixes,
      reviewCount: acc.reviewCount + r.reviewCount,
      privateDone: acc.privateDone + r.privateDone,
      netAmount: acc.netAmount + r.netAmount,
    }),
    { totalHours: 0, heuresFixes: 0, reviewCount: 0, privateDone: 0, netAmount: 0 }
  );

  // reviewPastilles (oldest first, see DigestRow) draws as small colored
  // dots after the count, same as the dashboard's Review column — omitted
  // for the Total row, which has no single coach's reviews to show.
  const drawRow = (
    cells: string[],
    rowFont: PDFFont,
    targetPage: PDFPage,
    atY: number,
    reviewPastilles?: string[]
  ) => {
    let x = MARGIN;
    for (let i = 0; i < COLUMNS.length; i++) {
      targetPage.drawText(cells[i], { x, y: atY, size: 10, font: rowFont, color: rgb(0.1, 0.1, 0.1) });
      if (i === REVIEW_COLUMN_INDEX && reviewPastilles?.length) {
        const dotRadius = 2.5;
        const dotSpacing = 7;
        const maxX = x + COLUMNS[i].width - dotRadius - 2;
        let dotX = x + rowFont.widthOfTextAtSize(cells[i], 10) + 6 + dotRadius;
        for (const pastille of reviewPastilles) {
          if (dotX + dotRadius > maxX) break;
          targetPage.drawCircle({
            x: dotX,
            y: atY + 3,
            size: dotRadius,
            color: hexToColor(pastilleColor(pastille)),
          });
          dotX += dotSpacing;
        }
      }
      x += COLUMNS[i].width;
    }
  };

  if (rows.length === 0) {
    page.drawText("Aucun coach pour l'instant.", { x: MARGIN, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
    y -= ROW_HEIGHT;
  }

  for (const row of rows) {
    if (y < MARGIN + ROW_HEIGHT) newPage();
    drawRow(cellsFor(row), font, page, y, row.reviewPastilles);
    y -= ROW_HEIGHT;
  }

  if (rows.length > 0) {
    if (y < MARGIN + ROW_HEIGHT) newPage();
    page.drawLine({
      start: { x: MARGIN, y: y + 12 },
      end: { x: MARGIN + tableWidth, y: y + 12 },
      thickness: 0.75,
      color: rgb(0.7, 0.7, 0.7),
    });
    drawRow(cellsFor({ name: "Total", ...totals }), boldFont, page, y);
  }

  return doc.save();
}
