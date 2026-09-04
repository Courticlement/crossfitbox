import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  tenantPrismaCache: Map<string, PrismaClient> | undefined;
};

// APP_DATABASE_URL is the same connection string as DATABASE_URL, kept as
// a second project env var specifically for Prisma Compute: DATABASE_URL
// is a system-managed key there and only auto-wires into a service that
// formally declares it as a Composer dependency (which this app doesn't —
// it connects to Postgres directly, the same way it always has), so a
// plain custom-named duplicate is what actually reaches the process.
function connectionUrl(): string {
  return process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;
}

function createPrismaClient() {
  const adapter = new PrismaPg(connectionUrl());
  return new PrismaClient({ adapter });
}

// The control-plane client — Organization and Admin only. Every other
// model lives in a per-organization Postgres schema (see tenantPrisma
// below); querying them through this client would fail with "relation
// does not exist" now that those tables no longer exist in `public`.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Each Organization's operational data (Coach, ClassTemplate,
// ClassInstance, Room, PlanningWeek, BoxClosure, CoachWeeklyQuota,
// ClassSubmission, ClassReview, Unavailability, PrivatePayment) lives in
// its own Postgres schema — "org_<organizationId>" — physically separate
// from every other organization's, not just filtered by an organizationId
// column. See prisma/migrations/<...>_schema_per_organization for how an
// existing organization's data was moved there, and createOrganization in
// lib/actions/organizations.ts for how a new one gets provisioned.
//
// The generated Prisma Client's model definitions are identical across
// every schema (they're all created from the same DDL), so one client
// class serves every tenant — only the underlying connection's target
// schema differs, via @prisma/adapter-pg's `schema` option ("the schema
// to use in generated queries"). Instances are cached per organizationId
// (module-level, survives across requests, like the control-plane
// singleton above) rather than created fresh per call, since each one
// holds its own connection pool.
function schemaNameFor(organizationId: string): string {
  // organizationId always comes from a source we trust (a signed session
  // token, or a row already read from the control-plane Admin/Organization
  // tables) — this check exists purely as a last-resort guard against ever
  // interpolating an unexpected value into a schema name, not as the
  // primary validation.
  if (!/^[a-zA-Z0-9_]+$/.test(organizationId)) {
    throw new Error(`Invalid organization id: ${organizationId}`);
  }
  return `org_${organizationId}`;
}

export function tenantSchemaName(organizationId: string): string {
  return schemaNameFor(organizationId);
}

export function tenantPrisma(organizationId: string): PrismaClient {
  const cache = (globalForPrisma.tenantPrismaCache ??= new Map());
  const existing = cache.get(organizationId);
  if (existing) return existing;

  const adapter = new PrismaPg(connectionUrl(), { schema: schemaNameFor(organizationId) });
  const client = new PrismaClient({ adapter });
  cache.set(organizationId, client);
  return client;
}
