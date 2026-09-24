"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createClassReview,
  type CreateClassReviewResult,
} from "@/lib/actions/reviews";
import {
  SEGMENTS,
  CLOSING_ACCENT,
  PILLARS,
  PILLAR_RATINGS,
  PILLAR_COLUMN,
  PASTILLES,
  REVIEW_CONTEXTS,
  type PillarKey,
  type PillarRating,
  type PastilleKey,
  type ReviewContextKey,
} from "@/lib/review-constants";
import { ReviewRecap } from "@/components/review-recap";

const initialState: CreateClassReviewResult = {};

export function ReviewWizard({
  classInfo,
  backHref,
}: {
  classInfo: {
    id: string;
    label: string;
    time: string;
    dateLabel: string;
    // Who this review is about — the class's coach, or one of its
    // assistants (see the class review page's subject picker).
    subjectId: string;
    subjectName: string;
    subjectRole: "coach" | "assistant";
  };
  backHref: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    (_prev: CreateClassReviewResult, formData: FormData) => createClassReview(formData),
    initialState
  );

  const [reviewContext, setReviewContext] = useState<ReviewContextKey | undefined>();
  const [notes, setNotes] = useState<Partial<Record<string, string>>>({});
  const [pillars, setPillars] = useState<Partial<Record<PillarKey, PillarRating>>>({});
  const [identifiedText, setIdentifiedText] = useState("");
  const [focusText, setFocusText] = useState("");
  const [pastille, setPastille] = useState<PastilleKey | undefined>();

  const pillarsComplete = PILLARS.every((p) => pillars[p.key]);
  const feedbackComplete = Boolean(focusText.trim()) && Boolean(pastille);
  const canSubmit = Boolean(reviewContext) && pillarsComplete && feedbackComplete;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-4 border-b border-neutral-800 px-6 py-4">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          aria-label="Retour"
          className="shrink-0 text-2xl leading-none text-white"
        >
          ‹
        </button>
        <div className="min-w-0">
          <div className="text-xl font-extrabold text-white">Nouvelle review</div>
          <div className="truncate text-[11px] text-neutral-500">
            {classInfo.label} · {classInfo.subjectName}
            {classInfo.subjectRole === "assistant" ? " (assistant·e)" : ""} · {classInfo.time}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-6">
        <form id="review-wizard-form" action={formAction}>
          <input type="hidden" name="classInstanceId" value={classInfo.id} />
          <input type="hidden" name="subjectCoachId" value={classInfo.subjectId} />

          <section className="mb-8">
            <h3 className="mb-1 text-[15px] font-extrabold" style={{ color: CLOSING_ACCENT }}>
              Contexte
            </h3>
            <p className="mb-3 text-[13.5px] text-neutral-400">
              De quoi cette review parle-t-elle ?
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {REVIEW_CONTEXTS.map((c) => {
                const selected = reviewContext === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setReviewContext(c.key)}
                    aria-pressed={selected}
                    className="flex items-center justify-center rounded-xl border-2 px-4 py-3.5 text-center"
                    style={{
                      borderColor: selected ? CLOSING_ACCENT : "#404040",
                      backgroundColor: selected ? `${CLOSING_ACCENT}1a` : "transparent",
                    }}
                  >
                    <span className="text-[14px] font-bold text-white">{c.label}</span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="reviewContext" value={reviewContext ?? ""} />
          </section>

          {SEGMENTS.map((seg) => (
            <section key={seg.key} className="mb-8">
              <h3 className="mb-3 text-[15px] font-extrabold" style={{ color: seg.accent }}>
                {seg.title}
              </h3>
              <textarea
                name={`${seg.key}Notes`}
                value={notes[seg.key] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [seg.key]: e.target.value }))}
                placeholder="Observations sur ce segment…"
                className="h-40 w-full resize-y rounded-xl border-[1.5px] bg-neutral-900 p-4 text-[15px] leading-relaxed text-white placeholder:text-neutral-600 focus:outline-none"
                style={{ borderColor: seg.accent }}
              />
            </section>
          ))}

          <section className="mb-8">
            <h3 className="mb-1 text-[15px] font-extrabold" style={{ color: CLOSING_ACCENT }}>
              Piliers
            </h3>
            <p className="mb-2 text-[13.5px] text-neutral-400">
              Évalue chaque pilier sur l&apos;ensemble de la séance.
            </p>
            <div className="divide-y divide-neutral-800">
              {PILLARS.map((p) => (
                <div key={p.key} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                  <span className="text-[14.5px] font-semibold text-white">{p.label}</span>
                  <div className="flex gap-2.5">
                    {PILLAR_RATINGS.map((r) => {
                      const selected = pillars[p.key] === r.value;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setPillars((prev) => ({ ...prev, [p.key]: r.value }))}
                          aria-pressed={selected}
                          aria-label={`${p.label} : ${r.value}`}
                          className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-extrabold transition-colors"
                          style={{
                            borderColor: r.color,
                            color: selected ? "#0a0a0a" : r.color,
                            backgroundColor: selected ? r.color : "transparent",
                          }}
                        >
                          {r.symbol}
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" name={PILLAR_COLUMN[p.key]} value={pillars[p.key] ?? ""} />
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h3 className="mb-4 text-[15px] font-extrabold" style={{ color: CLOSING_ACCENT }}>
              Feedback
            </h3>

            <div className="mb-6">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                Le coach a identifié
              </p>
              <textarea
                name="identifiedText"
                value={identifiedText}
                onChange={(e) => setIdentifiedText(e.target.value)}
                placeholder="Ce que le coach a reconnu pendant l’échange…"
                className="h-28 w-full resize-y rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-[15px] text-white placeholder:text-neutral-600 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="mb-6">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                Axe de travail principal
              </p>
              <textarea
                name="focusText"
                value={focusText}
                onChange={(e) => setFocusText(e.target.value)}
                placeholder="L’unique focus jusqu’à la prochaine observation…"
                className="h-28 w-full resize-y rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-[15px] text-white placeholder:text-neutral-600 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                Pastille de séance
              </p>
              <div className="grid grid-cols-4 gap-2.5">
                {PASTILLES.map((p) => {
                  const selected = pastille === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPastille(p.key)}
                      aria-pressed={selected}
                      className="flex flex-col items-center gap-2.5 rounded-xl border-2 py-4"
                      style={{
                        borderColor: p.color,
                        backgroundColor: selected ? `${p.color}26` : "transparent",
                      }}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[13px] font-bold" style={{ color: p.color }}>
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="pastille" value={pastille ?? ""} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[15px] font-extrabold" style={{ color: CLOSING_ACCENT }}>
              Récap
            </h3>
            <div className="mb-6 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
              <span className="text-[15px] font-bold text-white">
                {classInfo.label} <span className="font-normal text-neutral-500">— {classInfo.subjectName}</span>
              </span>
              <span className="text-right font-mono text-xs text-neutral-500">
                {classInfo.dateLabel}
                <br />
                {classInfo.time}
              </span>
            </div>

            <ReviewRecap
              reviewContext={reviewContext ?? null}
              segments={notes}
              pillars={pillars}
              identifiedText={identifiedText}
              focusText={focusText}
              pastille={pastille ?? null}
            />

            {state.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}
          </section>
        </form>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-6 pb-8 pt-2">
        {!canSubmit && (
          <p className="text-center text-[12px] text-neutral-500">
            Complète le contexte, les piliers, l&apos;axe de travail et la pastille pour valider.
          </p>
        )}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="w-14 shrink-0 rounded-xl border border-neutral-700 text-lg text-white hover:border-neutral-500"
          >
            ‹
          </button>
          <button
            type="submit"
            form="review-wizard-form"
            disabled={pending || !canSubmit}
            className="flex-1 rounded-xl bg-emerald-500 py-4 text-[15px] font-bold text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "Enregistrement…" : "Valider ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
