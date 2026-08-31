import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, formatDayLabel, parseDateOnly } from "@/lib/dates";
import { ReviewFilters } from "@/components/review-filters";
import { PILLARS, PILLAR_COLUMN, pastilleColor, pastilleLabel, pillarRatingColor } from "@/lib/review-constants";

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

  const [coaches, reviews] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classReview.findMany({
      where: {
        ...(from || to
          ? {
              classInstance: {
                date: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lt: addDays(to, 1) } : {}),
                },
              },
            }
          : {}),
        ...(coachIdFilter ? { classInstance: { coachId: coachIdFilter } } : {}),
        ...(pastilleFilter ? { pastille: pastilleFilter } : {}),
      },
      include: { classInstance: { include: { coach: true } } },
      orderBy: { classInstance: { date: "desc" } },
    }),
  ]);

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

      <ReviewFilters
        from={fromParam ?? ""}
        to={toParam ?? ""}
        coachId={coachIdFilter}
        pastille={pastilleFilter}
        coaches={coaches}
      />

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
                return (
                  <Link
                    key={review.id}
                    href={`/admin/reviews/${review.id}`}
                    className="grid grid-cols-[120px_1fr_auto_auto_auto] items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-600"
                  >
                    <span className="truncate text-sm font-semibold text-white">
                      {inst.coach?.name ?? "Non assigné"}
                    </span>
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
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
