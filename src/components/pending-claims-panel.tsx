import { formatDayLabel } from "@/lib/dates";
import { getPendingClaims } from "@/lib/class-claims";
import { approveClaim, rejectClaim } from "@/lib/actions/claims";

// The head coach's review queue for coaches claiming unassigned classes
// from their own My Classes view (see ClaimClassButton) — shown on the
// admin Dashboard and Planning pages, same placement as
// UnavailabilityAlert. A claim only ever reaches the coach's own
// ClassInstance.coachId once approved here.
export async function PendingClaimsPanel({ organizationId }: { organizationId: string }) {
  const claims = await getPendingClaims(organizationId);
  if (claims.length === 0) return null;

  return (
    <div className="mb-6 rounded-md border border-sky-900 bg-sky-950 px-3 py-2 text-sm text-sky-300">
      <p className="mb-2 font-medium text-sky-200">
        {claims.length} cours réclamé{claims.length === 1 ? "" : "s"} en attente de validation
      </p>
      <ul className="flex flex-col gap-1.5">
        {claims.map((claim) => (
          <li
            key={claim.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-sky-900/60 bg-sky-950/40 px-2 py-1.5"
          >
            <span>
              <strong className="text-sky-100">{claim.coach.name}</strong> veut prendre{" "}
              <strong className="text-sky-100">{claim.classInstance.label}</strong> —{" "}
              {formatDayLabel(claim.classInstance.date)} {claim.classInstance.startTime}–
              {claim.classInstance.endTime} ({claim.classInstance.room.name})
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <form action={approveClaim}>
                <input type="hidden" name="id" value={claim.id} />
                <button type="submit" className="text-xs font-medium text-emerald-300 underline hover:text-white">
                  Approuver
                </button>
              </form>
              <form action={rejectClaim}>
                <input type="hidden" name="id" value={claim.id} />
                <button type="submit" className="text-xs text-red-300 underline hover:text-white">
                  Refuser
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
