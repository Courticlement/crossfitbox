// Signed session cookies for the admin password gate and coach logins (see
// lib/actions/auth.ts). Uses Web Crypto (crypto.subtle), which is available
// in both the Node.js and Edge runtimes, so the same code verifies cookies
// in proxy.ts and in server actions/pages without caring which runtime
// either ends up on.

export const ADMIN_COOKIE = "admin_session";
export const COACH_COOKIE = "coach_session";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const encoder = new TextEncoder();

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

export async function createAdminSessionToken(): Promise<string> {
  return sign(`admin:${Date.now()}`);
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const payload = await verify(token);
  if (!payload) return false;
  const [kind, issuedAtStr] = payload.split(":");
  if (kind !== "admin") return false;
  return Date.now() - Number(issuedAtStr) < SESSION_MAX_AGE_MS;
}

export async function createCoachSessionToken(coachId: string): Promise<string> {
  return sign(`coach:${coachId}:${Date.now()}`);
}

// Returns the coachId iff the token is a valid, unexpired coach session.
export async function verifyCoachSessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const payload = await verify(token);
  if (!payload) return null;
  const [kind, coachId, issuedAtStr] = payload.split(":");
  if (kind !== "coach" || !coachId) return null;
  if (Date.now() - Number(issuedAtStr) >= SESSION_MAX_AGE_MS) return null;
  return coachId;
}
