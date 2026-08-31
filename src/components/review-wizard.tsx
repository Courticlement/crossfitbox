"use client";

import { useActionState, useEffect, useState } from "react";
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
  type PillarKey,
  type PillarRating,
  type PastilleKey,
} from "@/lib/review-constants";
import { ReviewRecap } from "@/components/review-recap";

const TOTAL_STEPS = 8; // 5 segments + Piliers + Feedback + Récap
const PROGRESS_SEGMENTS = 7; // Récap doesn't get its own tick — it's the confirm screen
const NEXT_LABEL = ["Suivant", "Suivant", "Suivant", "Suivant", "Piliers", "Feedback", "Récap", "Valider"];

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
    coachName: string;
  };
  backHref: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    (_prev: CreateClassReviewResult, formData: FormData) => createClassReview(formData),
    initialState
  );

  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState<Partial<Record<string, string>>>({});
  const [pillars, setPillars] = useState<Partial<Record<PillarKey, PillarRating>>>({});
  const [identifiedText, setIdentifiedText] = useState("");
  const [focusText, setFocusText] = useState("");
  const [pastille, setPastille] = useState<PastilleKey | undefined>();

  const isSegment = step < SEGMENTS.length;
  const isPillars = step === 5;
  const isFeedback = step === 6;
  const isRecap = step === 7;

  const accent = isSegment ? SEGMENTS[step].accent : CLOSING_ACCENT;
  const title = isRecap ? "Récap" : isFeedback ? "Feedback" : isPillars ? "Piliers" : SEGMENTS[step].title;

  const canAdvance = isPillars
    ? PILLARS.every((p) => pillars[p.key])
    : isFeedback
      ? Boolean(focusText.trim()) && Boolean(pastille)
      : true;

  function goBack() {
    if (step === 0) router.push(backHref);
    else setStep((s) => s - 1);
  }
  function goNext() {
    if (!canAdvance) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  // "Valider" sits in the exact same footer slot the "Récap →" button just
  // occupied — a fast double-click (trackpad double-tap, or a stray repeat
  // event) can land its second click on Valider before anyone's actually
  // looked at the recap. A brief disable on arrival closes that gap.
  const [recapReady, setRecapReady] = useState(false);
  useEffect(() => {
    if (!isRecap || recapReady) return;
    const timer = setTimeout(() => setRecapReady(true), 500);
    return () => clearTimeout(timer);
  }, [isRecap, recapReady]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-neutral-950">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-4 border-b border-neutral-800 px-6 py-4">
        <button
          type="button"
          onClick={goBack}
          aria-label="Retour"
          className="shrink-0 text-2xl leading-none text-white"
        >
          ‹
        </button>
        <div className="min-w-0">
          <div className="text-xl font-extrabold" style={{ color: isSegment ? accent : "#ffffff" }}>
            {title}
          </div>
          <div className="truncate text-[11px] text-neutral-500">
            {classInfo.label} · {classInfo.coachName} · {classInfo.time}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl gap-1.5 px-6 pt-4">
        {Array.from({ length: PROGRESS_SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < step ? "bg-red-800" : i === step ? "bg-red-500" : "bg-red-950"
            }`}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-6">
        <form id="review-wizard-form" action={formAction}>
          <input type="hidden" name="classInstanceId" value={classInfo.id} />

          {SEGMENTS.map((seg, i) => (
            <div key={seg.key} className={step === i ? "" : "hidden"}>
              <p className="mb-4 text-[13.5px] text-neutral-400">
                Étape {i + 1} sur {PROGRESS_SEGMENTS} — observations sur ce temps de cours.
              </p>
              <textarea
                name={`${seg.key}Notes`}
                value={notes[seg.key] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [seg.key]: e.target.value }))}
                placeholder="Observations sur ce segment…"
                className="h-72 w-full resize-y rounded-xl border-[1.5px] bg-neutral-900 p-4 text-[15px] leading-relaxed text-white placeholder:text-neutral-600 focus:outline-none"
                style={{ borderColor: seg.accent }}
              />
            </div>
          ))}

          <div className={isPillars ? "" : "hidden"}>
            <p className="mb-2 text-[13.5px] text-neutral-400">
              Évalue chaque pilier sur l&apos;ensemble de la séance.
            </p>
            <div className="divide-y divide-neutral-800">
              {PILLARS.map((p) => (
                <div key={p.key} className="flex items-center justify-between py-4">
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
          </div>

          <div className={isFeedback ? "" : "hidden"}>
            <div className="mb-5 inline-block rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-bold text-neutral-400">
              Coach Tracker – CFL3
            </div>

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
          </div>

          <div className={isRecap ? "" : "hidden"}>
            <div className="mb-6 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
              <span className="text-[15px] font-bold text-white">
                {classInfo.label} <span className="font-normal text-neutral-500">— {classInfo.coachName}</span>
              </span>
              <span className="text-right font-mono text-xs text-neutral-500">
                {classInfo.dateLabel}
                <br />
                {classInfo.time}
              </span>
            </div>

            <ReviewRecap
              segments={notes}
              pillars={pillars}
              identifiedText={identifiedText}
              focusText={focusText}
              pastille={pastille ?? null}
            />

            {state.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}
          </div>
        </form>
      </div>

      <div className="mx-auto flex w-full max-w-2xl gap-2.5 px-6 pb-8 pt-2">
        <button
          type="button"
          onClick={goBack}
          className="w-14 shrink-0 rounded-xl border border-neutral-700 text-lg text-white hover:border-neutral-500"
        >
          ‹
        </button>
        {isRecap ? (
          <button
            type="submit"
            form="review-wizard-form"
            disabled={pending || !recapReady}
            className="flex-1 rounded-xl bg-emerald-500 py-4 text-[15px] font-bold text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "Enregistrement…" : "Valider ✓"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            className="flex-1 rounded-xl py-4 text-[15px] font-bold text-neutral-950 disabled:opacity-40"
            style={{ backgroundColor: accent }}
          >
            {NEXT_LABEL[step]} →
          </button>
        )}
      </div>
    </div>
  );
}
