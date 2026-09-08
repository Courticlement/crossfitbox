"use client";

import { useState, useSyncExternalStore } from "react";
import { regenerateCalendarToken } from "@/lib/actions/calendar-sync";

// The origin (protocol + host) is only knowable in the browser — reading it
// this way instead of guessing it server-side keeps this correct in every
// environment (localhost, a preview deploy, production) without a
// dedicated "app base URL" env var. useSyncExternalStore (rather than an
// effect writing to state) is what keeps the server-rendered pass and the
// first client render in agreement: both get the empty getServerSnapshot
// value, and the real origin only appears once the client is actually
// live to have one. Nothing here ever changes after mount, so subscribe is
// a no-op.
const noSubscription = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => ""
  );
}

export function CalendarSyncCard({
  organizationId,
  token,
}: {
  organizationId: string;
  token: string | null;
}) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const url = token ? `${origin || "…"}/calendar/${organizationId}/${token}` : null;

  async function copyUrl() {
    if (!url || !origin) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-1 text-sm font-medium text-white">Synchroniser avec mon calendrier</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Ajoutez ce lien à l&apos;app Calendrier de votre téléphone pour voir vos cours
        automatiquement — elle se met à jour toute seule au fil des changements de planning.
      </p>

      {url && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={copyUrl}
            disabled={!origin}
            className="shrink-0 rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
      )}

      {url && (
        <details className="mb-3 text-xs text-neutral-500">
          <summary className="cursor-pointer select-none text-neutral-400 hover:text-white">
            Comment l&apos;ajouter sur mon téléphone
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 pl-4">
            <li className="list-disc">
              <strong className="text-neutral-400">iPhone :</strong> Réglages → Calendrier →
              Comptes → Ajouter un compte → Autre → Ajouter un abonnement calendrier, puis
              collez le lien.
            </li>
            <li className="list-disc">
              <strong className="text-neutral-400">Google Calendar :</strong> sur
              calendar.google.com → Autres agendas (+) → À partir de l&apos;URL, puis collez le
              lien.
            </li>
          </ul>
        </details>
      )}

      <form action={regenerateCalendarToken}>
        <button
          type="submit"
          className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
        >
          {token ? "Régénérer le lien" : "Activer la synchronisation"}
        </button>
        {token && (
          <span className="ml-2 text-xs text-neutral-600">
            L&apos;ancien lien cessera de fonctionner.
          </span>
        )}
      </form>
    </div>
  );
}
