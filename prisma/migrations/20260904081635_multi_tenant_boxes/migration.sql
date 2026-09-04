-- Multi-tenant boxes: Organization + Room models, org-scoping added to
-- Admin, Coach, ClassTemplate/ClassInstance (room -> roomId FK),
-- PlanningWeek, BoxClosure.
--
-- Hand-written rather than `prisma migrate dev`-generated because: (1) the
-- recorded migration history had drifted from the live database (the schema
-- evolved via `prisma db push` for a while without new migration files), so
-- a normal diff-based migration would have demanded a destructive reset of
-- real production data; and (2) `room: String -> roomId` is a rename Prisma
-- can't infer on its own, and the whole change needs an
-- expand -> seed -> backfill -> contract sequence in one place, which is
-- exactly what this file does, in order, inside one transaction.

-- ── 1. New tables ───────────────────────────────────────────────────────
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT,
    "color" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Room_organizationId_name_key" ON "Room"("organizationId", "name");
ALTER TABLE "Room" ADD CONSTRAINT "Room_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Add nullable FK columns to existing tables ──────────────────────────
ALTER TABLE "Admin" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Coach" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "PlanningWeek" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "BoxClosure" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ClassTemplate" ADD COLUMN "roomId" TEXT;
ALTER TABLE "ClassInstance" ADD COLUMN "roomId" TEXT;

-- ── 3. Seed one default Organization + its two existing rooms, and one
--       bootstrap PLATFORM_SUPERADMIN so /superadmin is reachable after
--       this migration runs (no existing account becomes this
--       automatically). Temp password reported once, out of band, after
--       implementation — never committed in plaintext anywhere else. ─────
INSERT INTO "Organization" ("id", "name", "createdAt") VALUES
  ('c07f2b1b0b9fb4b1c835d41317f51bef0', 'Crossfit Box', CURRENT_TIMESTAMP);

INSERT INTO "Room" ("id", "organizationId", "name", "shortLabel", "color", "archived", "createdAt") VALUES
  ('c1a6b20c041de4a4aa79ed50e28750317', 'c07f2b1b0b9fb4b1c835d41317f51bef0', 'Salle 1', 'S1', '#0ea5e9', false, CURRENT_TIMESTAMP),
  ('cbf923bf927da4c23b9f2bfadc29afdef', 'c07f2b1b0b9fb4b1c835d41317f51bef0', 'Salle 2', 'S2', '#8b5cf6', false, CURRENT_TIMESTAMP);

-- ── 4. Backfill every existing (pre-migration) Admin/Coach/PlanningWeek/
--       BoxClosure row onto the default Organization — deliberately runs
--       BEFORE inserting the bootstrap PLATFORM_SUPERADMIN below, since that
--       row's organizationId must stay NULL and this UPDATE has no way to
--       tell it apart from a pre-existing NULL otherwise. ────────────────
UPDATE "Admin" SET "organizationId" = 'c07f2b1b0b9fb4b1c835d41317f51bef0' WHERE "organizationId" IS NULL;
UPDATE "Coach" SET "organizationId" = 'c07f2b1b0b9fb4b1c835d41317f51bef0';
UPDATE "PlanningWeek" SET "organizationId" = 'c07f2b1b0b9fb4b1c835d41317f51bef0';
UPDATE "BoxClosure" SET "organizationId" = 'c07f2b1b0b9fb4b1c835d41317f51bef0';

UPDATE "ClassTemplate" SET "roomId" = 'c1a6b20c041de4a4aa79ed50e28750317' WHERE "room" = 'Salle 1';
UPDATE "ClassTemplate" SET "roomId" = 'cbf923bf927da4c23b9f2bfadc29afdef' WHERE "room" = 'Salle 2';
UPDATE "ClassInstance" SET "roomId" = 'c1a6b20c041de4a4aa79ed50e28750317' WHERE "room" = 'Salle 1';
UPDATE "ClassInstance" SET "roomId" = 'cbf923bf927da4c23b9f2bfadc29afdef' WHERE "room" = 'Salle 2';

INSERT INTO "Admin" ("id", "email", "passwordHash", "role", "organizationId", "archived", "createdAt") VALUES
  ('c9bd914ddf79b4a18af84454c44dfa63e', 'cl.courtiol+admin@gmail.com', '6fa44d62e4f0fb2188cdefee1899766e:7e980356f8bf3a964240764d6b0d82df491411cf0897d879eb39829bba7ea0753621dfcb301355ef07de40a1a6d1ecf2e1c7ef67450a486938cec1ed1cada526', 'PLATFORM_SUPERADMIN', NULL, false, CURRENT_TIMESTAMP);

-- ── 5. Tighten to NOT NULL now that every row has a value (Admin stays
--       nullable — null means PLATFORM_SUPERADMIN, that's intentional) ────
ALTER TABLE "Coach" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PlanningWeek" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "BoxClosure" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ClassTemplate" ALTER COLUMN "roomId" SET NOT NULL;
ALTER TABLE "ClassInstance" ALTER COLUMN "roomId" SET NOT NULL;

-- ── 6. Drop the old global unique constraints + free-text room columns ────
DROP INDEX "Coach_name_key";
DROP INDEX "Coach_color_key";
DROP INDEX "PlanningWeek_weekStart_key";
DROP INDEX "BoxClosure_date_key";

ALTER TABLE "ClassTemplate" DROP COLUMN "room";
ALTER TABLE "ClassInstance" DROP COLUMN "room";

-- ── 7. New composite unique constraints, indexes, and foreign keys ────────
CREATE UNIQUE INDEX "Coach_organizationId_name_key" ON "Coach"("organizationId", "name");
CREATE UNIQUE INDEX "Coach_organizationId_color_key" ON "Coach"("organizationId", "color");
CREATE UNIQUE INDEX "PlanningWeek_organizationId_weekStart_key" ON "PlanningWeek"("organizationId", "weekStart");
CREATE UNIQUE INDEX "BoxClosure_organizationId_date_key" ON "BoxClosure"("organizationId", "date");
CREATE INDEX "ClassTemplate_roomId_idx" ON "ClassTemplate"("roomId");
CREATE INDEX "ClassInstance_roomId_idx" ON "ClassInstance"("roomId");

ALTER TABLE "Admin" ADD CONSTRAINT "Admin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningWeek" ADD CONSTRAINT "PlanningWeek_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoxClosure" ADD CONSTRAINT "BoxClosure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassInstance" ADD CONSTRAINT "ClassInstance_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
