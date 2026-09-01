import { prisma } from "@/lib/prisma";

// The one thing a coaching review is supposed to leave behind: the standing
// focus until the *next* observation. Surfaced on the coach's own page and
// summarized for the head coach on Suivi coaching — a review only pays off
// if its focus doesn't get forgotten the moment the wizard closes.
export type LastFocus = {
  reviewId: string;
  focusText: string;
  date: Date;
  classLabel: string;
};

export async function getLastFocus(coachId: string): Promise<LastFocus | null> {
  const review = await prisma.classReview.findFirst({
    where: { classInstance: { coachId } },
    orderBy: { classInstance: { date: "desc" } },
    include: { classInstance: { select: { date: true, label: true } } },
  });
  if (!review) return null;
  return {
    reviewId: review.id,
    focusText: review.focusText,
    date: review.classInstance.date,
    classLabel: review.classInstance.label,
  };
}

// One query for every coach at once (for the Suivi coaching summary) rather
// than one findFirst per coach — reviews are already sorted soonest-last so
// the first one seen per coach is their most recent.
export async function getLastFocusByCoach(coachIds: string[]): Promise<Map<string, LastFocus>> {
  const reviews = await prisma.classReview.findMany({
    where: { classInstance: { coachId: { in: coachIds } } },
    orderBy: { classInstance: { date: "desc" } },
    include: { classInstance: { select: { coachId: true, date: true, label: true } } },
  });
  const map = new Map<string, LastFocus>();
  for (const review of reviews) {
    const coachId = review.classInstance.coachId;
    if (!coachId || map.has(coachId)) continue;
    map.set(coachId, {
      reviewId: review.id,
      focusText: review.focusText,
      date: review.classInstance.date,
      classLabel: review.classInstance.label,
    });
  }
  return map;
}
