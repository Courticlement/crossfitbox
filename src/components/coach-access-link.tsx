"use client";

import { useState } from "react";
import { regenerateCoachAccessToken } from "@/lib/actions/coaches";

// Lets the admin grab (or reissue) a coach's private upload link straight
// from their ID card, instead of digging it out of the database.
export function CoachAccessLink({ coachId, token }: { coachId: string; token: string }) {
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
    <div className="flex items-center gap-2 text-xs">
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="text-neutral-400 hover:text-white"
      >
        Personal access
      </a>
      <button type="button" onClick={handleCopy} className="text-neutral-500 hover:text-white">
        {copied ? "Copied!" : "Copy link"}
      </button>
      <form
        action={regenerateCoachAccessToken}
        onSubmit={(e) => {
          if (!window.confirm("Generate a new link for this coach? The old link will stop working immediately.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={coachId} />
        <button type="submit" className="text-neutral-500 hover:text-red-300">
          Regenerate
        </button>
      </form>
    </div>
  );
}
