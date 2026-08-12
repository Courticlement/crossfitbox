"use client";

import { useState } from "react";
import { regenerateCoachAccessToken } from "@/lib/actions/coaches";

// Lets the admin grab (or reissue) a coach's private upload link straight
// from their ID card, instead of digging it out of the database. "Copy
// link" is the card's principal CTA — it's the one action an admin takes
// on this card most often — so it gets the same solid-white treatment as
// the app's other primary buttons; Open/Regenerate are secondary. The
// explanation of what this link is lives in the (i) tooltip instead of a
// full sentence, so the row stays a single compact line.
export function CoachAccessLink({
  coachId,
  coachFirstName,
  token,
  disabled = false,
}: {
  coachId: string;
  coachFirstName: string;
  token: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/upload/${token}`;

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-neutral-400">Private access</span>
      <span
        tabIndex={0}
        title={
          disabled
            ? "Disabled while archived — this link no longer lets them report classes."
            : `Share this link with ${coachFirstName} only. It opens straight to their own week — unlike the general /upload page, nobody else can pick their name from it.`
        }
        aria-label="What this link is"
        className="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-neutral-700 text-[10px] font-semibold leading-none text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
      >
        i
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a
          href={disabled ? undefined : path}
          target="_blank"
          rel="noopener noreferrer"
          title="Open link"
          aria-label="Open link"
          aria-disabled={disabled}
          className={`rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 ${
            disabled ? "pointer-events-none opacity-40" : "hover:border-neutral-500 hover:text-white"
          }`}
        >
          ↗
        </a>
        <form
          action={regenerateCoachAccessToken}
          onSubmit={(e) => {
            if (!window.confirm("Generate a new link for this coach? The old link will stop working immediately.")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={coachId} />
          <button
            type="submit"
            title="Regenerate link"
            aria-label="Regenerate link"
            className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:border-red-800 hover:text-red-300"
          >
            ↻
          </button>
        </form>
      </div>
    </div>
  );
}
