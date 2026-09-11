import { tenantPrisma } from "@/lib/prisma";

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

export async function getLastFocus(
  organizationId: string,
  coachId: string
): Promise<LastFocus | null> {
  // subjectCoachId, not classInstance.coachId — this coach's own focus,
  // whether the review was of them as the class's coach or as an
  // assistant on someone else's.
  const review = await tenantPrisma(organizationId).classReview.findFirst({
    where: { subjectCoachId: coachId },
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
export async function getLastFocusByCoach(
  organizationId: string,
  coachIds: string[]
): Promise<Map<string, LastFocus>> {
  const reviews = await tenantPrisma(organizationId).classReview.findMany({
    where: { subjectCoachId: { in: coachIds } },
    orderBy: { classInstance: { date: "desc" } },
    include: { classInstance: { select: { date: true, label: true } } },
  });
  const map = new Map<string, LastFocus>();
  for (const review of reviews) {
    const coachId = review.subjectCoachId;
    if (map.has(coachId)) continue;
    map.set(coachId, {
      reviewId: review.id,
      focusText: review.focusText,
      date: review.classInstance.date,
      classLabel: review.classInstance.label,
    });
  }
  return map;
}
