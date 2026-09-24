import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont } from "pdf-lib";
import {
  SEGMENTS,
  PILLARS,
  PILLAR_COLUMN,
  pillarRatingColor,
  pastilleColor,
  pastilleLabel,
  type SegmentKey,
  type PillarRating,
} from "@/lib/review-constants";
import { formatDayLabel } from "@/lib/dates";

// A4 portrait, points — same page geometry as digest-pdf.ts.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function hexToColor(hex: string): Color {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["—"];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

// The exact shape renderReviewsPdf needs from a ClassReview row — kept
// explicit (rather than importing Prisma's generated type) so this file
// doesn't need a live db connection to typecheck, same reasoning as
// digest-pdf.ts taking a plain DigestRow.
export type ReviewPdfRow = {
  briefingNotes: string | null;
  generalWuNotes: string | null;
  specificWuNotes: string | null;
  skillWodNotes: string | null;
  coolDownNotes: string | null;
  pillarEnseignement: string;
  pillarObservation: string;
  pillarCorrection: string;
  pillarGestionGroupe: string;
  pillarPresenceAttitude: string;
  pillarDemonstration: string;
  identifiedText: string | null;
  focusText: string;
  pastille: string;
  classInstance: { label: string; date: Date; startTime: string; endTime: string };
  subjectCoach: { name: string };
};

// Full detail export for admin use — one section per coach, one block per
// review with every segment's verbatim notes, all six pillars, the
// feedback text, and the pastille (unlike the coach-facing recap, this
// export is for the admin's own record, so nothing is held back).
export async function renderReviewsPdf(reviews: ReviewPdfRow[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Reviews");
  doc.setCreator("Crossfit Box");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawWrappedField = (label: string, text: string) => {
    const lines = wrapText(text, font, 9.5, CONTENT_WIDTH - 8);
    ensureSpace(13 + lines.length * 13 + 4);
    page.drawText(label, { x: MARGIN, y, size: 9.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    y -= 13;
    for (const line of lines) {
      page.drawText(line, { x: MARGIN + 8, y, size: 9.5, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 13;
    }
    y -= 4;
  };

  if (reviews.length === 0) {
    page.drawText("Aucune review pour les coachs sélectionnés.", {
      x: MARGIN,
      y,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return doc.save();
  }

  const segmentsOf = (r: ReviewPdfRow): Record<SegmentKey, string | null> => ({
    briefing: r.briefingNotes,
    generalWu: r.generalWuNotes,
    specificWu: r.specificWuNotes,
    skillWod: r.skillWodNotes,
    coolDown: r.coolDownNotes,
  });

  let lastCoach: string | null = null;
  for (const review of reviews) {
    if (review.subjectCoach.name !== lastCoach) {
      lastCoach = review.subjectCoach.name;
      if (y !== PAGE_HEIGHT - MARGIN) y -= 10;
      ensureSpace(26);
      page.drawText(lastCoach, { x: MARGIN, y, size: 16, font: boldFont, color: rgb(0.07, 0.07, 0.07) });
      y -= 26;
    }

    const inst = review.classInstance;
    ensureSpace(18);
    page.drawText(`${inst.label} — ${formatDayLabel(inst.date)} · ${inst.startTime}–${inst.endTime}`, {
      x: MARGIN,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 18;

    for (const seg of SEGMENTS) {
      drawWrappedField(seg.title, segmentsOf(review)[seg.key] || "—");
    }

    ensureSpace(13);
    page.drawText("Piliers", { x: MARGIN, y, size: 9.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    y -= 15;
    for (const p of PILLARS) {
      const rating = review[PILLAR_COLUMN[p.key] as keyof ReviewPdfRow] as PillarRating;
      ensureSpace(13);
      page.drawCircle({ x: MARGIN + 4, y: y + 3, size: 2.5, color: hexToColor(pillarRatingColor(rating)) });
      page.drawText(p.label, { x: MARGIN + 13, y, size: 9.5, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 13;
    }
    y -= 4;

    drawWrappedField("Le coach a identifié", review.identifiedText || "—");
    drawWrappedField("Axe de travail", review.focusText || "—");

    ensureSpace(20);
    const pColor = hexToColor(pastilleColor(review.pastille));
    page.drawText("Pastille de séance", { x: MARGIN, y, size: 9.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawCircle({ x: MARGIN + 118, y: y + 3, size: 3, color: pColor });
    page.drawText(pastilleLabel(review.pastille), { x: MARGIN + 126, y, size: 9.5, font: boldFont, color: pColor });
    y -= 22;

    ensureSpace(10);
    page.drawLine({
      start: { x: MARGIN, y: y + 8 },
      end: { x: MARGIN + CONTENT_WIDTH, y: y + 8 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 6;
  }

  return doc.save();
}
