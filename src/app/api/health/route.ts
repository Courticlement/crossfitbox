import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, unauthenticated — proxy.ts's matcher doesn't cover /api, so this
// is reachable with no session. Exists purely so an external monitor (or a
// scheduled check) can exercise the same control-plane DB connection that
// every real page load needs, without going through a login form. A
// round-trip here is the cheapest way to catch the failure mode from
// 2026-09-21: the DB (or the compute container) waking from idle slowly
// enough that Prisma Compute's own response-streaming timeout gives up
// first, surfacing to users as a gateway timeout.
// A monitor must never be answered from a cache — every hit has to reach the DB.
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, dbMs: Date.now() - startedAt }, { headers: NO_STORE });
  } catch (err) {
    return NextResponse.json(
      { ok: false, dbMs: Date.now() - startedAt, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: NO_STORE }
    );
  }
}
