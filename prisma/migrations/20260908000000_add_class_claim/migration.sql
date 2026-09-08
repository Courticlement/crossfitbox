-- Adds ClassClaim (a coach's request to take an unassigned class, pending
-- head-coach approval — see lib/actions/claims.ts).
--
-- Documentation only, like every migration since 20260904081635_multi_tenant_boxes:
-- tenant tables (Coach, ClassInstance, ...) live in each organization's own
-- "org_<id>" Postgres schema, not "public" (see lib/prisma.ts), so this
-- CREATE TABLE was actually applied per existing org schema by a one-off
-- script (mirroring lib/tenant-schema.ts's tenantTableDdl/
-- tenantTableForeignKeys, which is what provisions this table for every
-- *new* org going forward). Keep this file's DDL in sync with both.
CREATE TABLE "ClassClaim" (
    "id" TEXT NOT NULL,
    "classInstanceId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ClassClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassClaim_classInstanceId_coachId_key" ON "ClassClaim"("classInstanceId", "coachId");

CREATE INDEX "ClassClaim_classInstanceId_idx" ON "ClassClaim"("classInstanceId");

CREATE INDEX "ClassClaim_status_idx" ON "ClassClaim"("status");

ALTER TABLE "ClassClaim" ADD CONSTRAINT "ClassClaim_classInstanceId_fkey" FOREIGN KEY ("classInstanceId") REFERENCES "ClassInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassClaim" ADD CONSTRAINT "ClassClaim_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
