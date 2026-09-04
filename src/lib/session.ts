// Signed session cookies for the admin password gate and coach logins (see
// lib/actions/auth.ts). Uses Web Crypto (crypto.subtle), which is available
// in both the Node.js and Edge runtimes, so the same code verifies cookies
// in proxy.ts and in server actions/pages without caring which runtime
// either ends up on.

export const ADMIN_COOKIE = "admin_session";
export const COACH_COOKIE = "coach_session";
// Holds a PLATFORM_SUPERADMIN's own admin_session token while they're
// impersonating a box's admin (see impersonateOrganization/
// stopImpersonating in lib/actions/organizations.ts) — admin_session itself
// gets overwritten with the impersonated admin's token for that duration,
// so this is the only way back without re-entering platform credentials.
export const IMPERSONATOR_COOKIE = "admin_impersonator_session";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const encoder = new TextEncoder();

// Mirrors SESSION_MAX_AGE_MS above — the cookie's own expiry and the signed
// token's embedded expiry should agree. Shared by every place that sets
// ADMIN_COOKIE, COACH_COOKIE, or IMPERSONATOR_COOKIE (lib/actions/auth.ts,
// lib/actions/organizations.ts).
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days, in seconds
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sign(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(payload));
  return `${payload}.${toHex(sig)}`;
}

// Returns the payload iff the signature is valid — callers must still check
// the payload's own shape/expiry (see verifyAdminSessionToken/
// verifyCoachSessionToken below).
async function verify(token: string): Promise<string | null> {
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const sigHex = token.slice(idx + 1);
  if (!/^[0-9a-f]+$/.test(sigHex)) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await getKey(),
    fromHex(sigHex) as BufferSource,
    encoder.encode(payload)
  );
  return valid ? payload : null;
}

// organizationId is null only for a PLATFORM_SUPERADMIN (see Admin.role) —
// every other role always carries the box it belongs to, embedded here so
// every org-scoped admin action/page can trust it without a DB round trip
// (see requireOrgAdmin in auth-context.ts).
export type AdminSession = { adminId: string; role: string; organizationId: string | null };

export async function createAdminSessionToken(
  adminId: string,
  role: string,
  organizationId: string | null
): Promise<string> {
  return sign(`admin:${adminId}:${role}:${organizationId ?? ""}:${Date.now()}`);
}

export async function verifyAdminSessionToken(
  token: string | undefined
): Promise<AdminSession | null> {
  if (!token) return null;
  const payload = await verify(token);
  if (!payload) return null;
  const parts = payload.split(":");
  // Exactly 5 parts: kind:adminId:role:organizationId:issuedAt. A token
  // signed before organizationId was added to this payload (4 parts) must
  // be rejected outright rather than parsed positionally — otherwise its
  // trailing timestamp silently shifts into organizationId's slot instead
  // of issuedAt's, producing a garbage-but-truthy "organization id" (an
  // old millisecond timestamp) that then fails as a foreign key wherever
  // it's used, instead of the clean re-login this is supposed to force.
  if (parts.length !== 5) return null;
  const [kind, adminId, role, organizationIdRaw, issuedAtStr] = parts;
  if (kind !== "admin" || !adminId || !role) return null;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt >= SESSION_MAX_AGE_MS) return null;
  return { adminId, role, organizationId: organizationIdRaw || null };
}

// organizationId is embedded so coach-facing actions/pages can pick the
// right per-organization Postgres schema (see tenantPrisma in lib/prisma.ts)
// without a chicken-and-egg lookup — Coach itself lives in that schema, so
// there'd be no way to find the coach's own row to discover their
// organizationId without already knowing which schema to query.
export type CoachSession = { coachId: string; organizationId: string };

export async function createCoachSessionToken(
  coachId: string,
  organizationId: string
): Promise<string> {
  return sign(`coach:${coachId}:${organizationId}:${Date.now()}`);
}

// Returns the coach session iff the token is a valid, unexpired coach
// session. Null for a token signed before organizationId was added to this
// payload (3 parts instead of 4) — same reasoning as verifyAdminSessionToken
// above: parsed positionally, that old token's trailing timestamp would
// otherwise silently land in organizationId's slot instead of issuedAt's.
export async function verifyCoachSessionToken(
  token: string | undefined
): Promise<CoachSession | null> {
  if (!token) return null;
  const payload = await verify(token);
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 4) return null;
  const [kind, coachId, organizationId, issuedAtStr] = parts;
  if (kind !== "coach" || !coachId || !organizationId) return null;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt >= SESSION_MAX_AGE_MS) return null;
  return { coachId, organizationId };
}
