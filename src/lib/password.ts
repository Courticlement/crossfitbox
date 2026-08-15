import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Node-only (scrypt isn't available via Web Crypto) — this file must never be
// imported from middleware.ts or anywhere else that runs on the Edge
// runtime. Session token verification (see lib/session.ts) is deliberately
// separate so the Edge-compatible path never needs this module.
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = scryptSync(password, salt, KEY_LENGTH);
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(hashBuffer, candidateBuffer);
}
