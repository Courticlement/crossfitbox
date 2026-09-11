-- Adds assistant coaches on a group class (ClassInstanceAssistant — 0, 1 or
-- several per ClassInstance, independent of coachId) and lets a ClassReview
-- be about the class's coach or one of its assistants instead of always
-- being "the one review of the class" (ClassReview.classInstanceId was
-- @unique; now (classInstanceId, subjectCoachId) is).
--
-- Documentation only, like every migration since 20260904081635_multi_tenant_boxes:
-- tenant tables live in each organization's own "org_<id>" Postgres schema,
-- not "public" (see lib/prisma.ts), so this was actually applied per
-- existing org schema by a one-off script (mirroring lib/tenant-schema.ts's
-- tenantTableDdl/tenantTableForeignKeys, which is what provisions these
-- tables for every *new* org going forward). Keep this file in sync with
-- both.

CREATE TABLE "ClassInstanceAssistant" (
  "id" TEXT NOT NULL,
  "classInstanceId" TEXT NOT NULL,
  "coachId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassInstanceAssistant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassInstanceAssistant_classInstanceId_coachId_key" ON "ClassInstanceAssistant"("classInstanceId", "coachId");
CREATE INDEX "ClassInstanceAssistant_coachId_idx" ON "ClassInstanceAssistant"("coachId");
ALTER TABLE "ClassInstanceAssistant" ADD CONSTRAINT "ClassInstanceAssistant_classInstanceId_fkey" FOREIGN KEY ("classInstanceId") REFERENCES "ClassInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassInstanceAssistant" ADD CONSTRAINT "ClassInstanceAssistant_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClassReview: add subjectCoachId, backfill from the class's coachId (every
-- review written before this migration was implicitly about the coach),
-- then tighten to NOT NULL and swap the uniqueness.
ALTER TABLE "ClassReview" ADD COLUMN "subjectCoachId" TEXT;
UPDATE "ClassReview" r SET "subjectCoachId" = ci."coachId"
  FROM "ClassInstance" ci WHERE ci."id" = r."classInstanceId" AND r."subjectCoachId" IS NULL;
ALTER TABLE "ClassReview" ALTER COLUMN "subjectCoachId" SET NOT NULL;
ALTER TABLE "ClassReview" ADD CONSTRAINT "ClassReview_subjectCoachId_fkey" FOREIGN KEY ("subjectCoachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "ClassReview_classInstanceId_key";
CREATE UNIQUE INDEX "ClassReview_classInstanceId_subjectCoachId_key" ON "ClassReview"("classInstanceId", "subjectCoachId");
CREATE INDEX "ClassReview_classInstanceId_idx" ON "ClassReview"("classInstanceId");
