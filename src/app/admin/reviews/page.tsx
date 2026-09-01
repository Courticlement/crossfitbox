import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, formatDayLabel, parseDateOnly } from "@/lib/dates";
import { ReviewFilters } from "@/components/review-filters";
import { CoachingEvolutionChart, type EvolutionPoint } from "@/components/coaching-evolution-chart";
import { CoachingFocusPanel } from "@/components/coaching-focus-panel";
import { DeleteReviewButton } from "@/components/delete-review-button";
import {
  ReviewsBulkDeleteBar,
  REVIEWS_BULK_DELETE_FORM_ID,
} from "@/components/reviews-bulk-delete-bar";
import { getLastFocusByCoach } from "@/lib/coaching-focus";
import {
  PILLARS,
  PILLAR_COLUMN,
  pastilleColor,
  pastilleLabel,
  pillarRatingColor,
  reviewScore,
} from "@/lib/review-constants";

export default async function ReviewsPage({
  searchParams,
}: PageProps<"/admin/reviews">) {
  const params = await searchParams;
  const fromParam = typeof params?.from === "string" ? params.from : undefined;
  const toParam = typeof params?.to === "string" ? params.to : undefined;
  const coachIdFilter = typeof params?.coachId === "string" ? params.coachId : "";
  const pastilleFilter = typeof params?.pastille === "string" ? params.pastille : "";

  const from = fromParam ? parseDateOnly(fromParam) : null;
  const to = toParam ? parseDateOnly(toParam) : null;

  const dateWhere = from || to
    ? {
        classInstance: {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lt: addDays(to, 1) } : {}),
          },
        },
      }
    : {};

  const [coaches, reviews, chartReviews] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classReview.findMany({
      where: {
        ...dateWhere,
        ...(coachIdFilter ? { classInstance: { coachId: coachIdFilter } } : {}),
        ...(pastilleFilter ? { pastille: pastilleFilter } : {}),
      },
      include: { classInstance: { include: { coach: true } } },
      orderBy: { classInstance: { date: "desc" } },
    }),
    // The chart always compares every coach — the Coach filter only
    // narrows the list above and highlights (not hides) a line in the
    // chart, so it's fetched separately, ignoring coachIdFilter.
    prisma.classReview.findMany({
      where: { ...dateWhere, ...(pastilleFilter ? { pastille: pastilleFilter } : {}) },
      include: { classInstance: { include: { coach: true } } },
    }),
  ]);

  // Independent of every filter above, same reasoning as the chart — this
  // is "what matters right now" for the whole team, not a slice of history.
  const lastFocusByCoach = await getLastFocusByCoach(coaches.map((c) => c.id));
  const focusItems = coaches
    .map((coach) => {
      const focus = lastFocusByCoach.get(coach.id);
      return focus ? { coachId: coach.id, coachName: coach.name, coachColor: coach.color, focus } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const evolutionPoints: EvolutionPoint[] = chartReviews
    .filter((r) => r.classInstance.coach !== null)
    .map((r) => ({
      id: r.id,
      date: r.classInstance.date,
      score: reviewScore(r),
      pastille: r.pastille,
      coachId: r.classInstance.coach!.id,
      coachName: r.classInstance.coach!.name,
      coachColor: r.classInstance.coach!.color,
    }));

  const groups = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const key = formatDateISO(review.classInstance.date);
    const list = groups.get(key) ?? [];
    list.push(review);
    groups.set(key, list);
  }

  return (
    <div className="text-neutral-300">
      <div className="mb-4">
        <p className="mb-1 text-[11px] font-mono uppercase tracking-wide text-neutral-500">Suivi coaching</p>
        <h1 className="mb-1 text-lg font-semibold text-white">Historique des reviews</h1>
        <p className="max-w-2xl text-sm text-neutral-400">
          Toutes les observations en classe, consultables par coach et par date pour suivre la progression dans le
          temps.
        </p>
      </div>

      <CoachingFocusPanel items={focusItems} />

      <ReviewFilters
        from={fromParam ?? ""}
        to={toParam ?? ""}
        coachId={coachIdFilter}
        pastille={pastilleFilter}
        coaches={coaches}
      />

      <CoachingEvolutionChart
        points={evolutionPoints}
        highlightCoachId={coachIdFilter}
        currentParams={{ from: fromParam, to: toParam, pastille: pastilleFilter || undefined }}
      />

      <ReviewsBulkDeleteBar />

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
          Aucune review ne correspond à ces filtres.
        </div>
      ) : (
        Array.from(groups.entries()).map(([dateKey, dayReviews]) => (
          <div key={dateKey} className="mb-6">
            <h3 className="mb-2 border-b border-neutral-900 pb-1.5 font-mono text-xs uppercase tracking-wide text-neutral-500">
              {formatDayLabel(dayReviews[0].classInstance.date)}
            </h3>
            <div className="flex flex-col gap-2">
              {dayReviews.map((review) => {
                const inst = review.classInstance;
                const color = pastilleColor(review.pastille);
                const coachLabel = inst.coach?.name ?? "Non assigné";
                return (
                  <div
                    key={review.id}
                    className="grid grid-cols-[auto_120px_1fr_auto_auto_auto_auto] items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-600"
                  >
                    <input
                      type="checkbox"
                      name="ids"
                      value={review.id}
                      form={REVIEWS_BULK_DELETE_FORM_ID}
                      aria-label={`Sélectionner la review de ${coachLabel}`}
                      className="h-4 w-4 accent-red-600"
                    />
                    <Link href={`/admin/reviews/${review.id}`} className="contents">
                      <span className="truncate text-sm font-semibold text-white">{coachLabel}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{inst.label}</span>
                        <span className="block text-xs text-neutral-500">{inst.startTime}–{inst.endTime}</span>
                      </span>
                      <span className="hidden gap-1 sm:flex">
                        {PILLARS.map((p) => (
                          <span
                            key={p.key}
                            title={p.label}
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor: pillarRatingColor(
                                review[PILLAR_COLUMN[p.key] as keyof typeof review] as string
                              ),
                            }}
                          />
                        ))}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        {pastilleLabel(review.pastille)}
                      </span>
                      <span className="text-xs font-semibold text-neutral-500">Voir →</span>
                    </Link>
                    <DeleteReviewButton reviewId={review.id} label={`de ${coachLabel} — ${inst.label}`} />
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
