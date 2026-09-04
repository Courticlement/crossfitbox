// The DDL for one organization's Postgres schema — every operational
// table (Room, Coach, ClassTemplate, ClassInstance, PlanningWeek,
// BoxClosure, CoachWeeklyQuota, ClassSubmission, ClassReview,
// Unavailability, PrivatePayment), byte-for-byte matching
// prisma/schema.prisma. Used by createOrganization (lib/actions/
// organizations.ts) to provision a brand-new org's schema, and mirrors
// exactly what the one-off migration in prisma/migrations/
// 20260904081635_multi_tenant_boxes did for existing organizations when
// this app moved from row-level (organizationId column) to schema-level
// tenant isolation.
//
// Hand-written rather than cloned from an existing org's schema (`LIKE
// "org_X"."Room" INCLUDING ALL`) so provisioning the very first
// organization on a fresh install doesn't depend on one already existing.
// If prisma/schema.prisma's tenant models ever change, this must be
// updated to match — there is currently no automated check for that.

function q(schema: string, table: string): string {
  return `"${schema}"."${table}"`;
}

export function tenantTableDdl(schema: string): string[] {
  return [
    `CREATE TABLE ${q(schema, "Room")} (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "shortLabel" TEXT,
      "color" TEXT,
      "archived" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "Room_organizationId_name_key" ON ${q(schema, "Room")}("organizationId", "name")`,

    `CREATE TABLE ${q(schema, "Coach")} (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "level" TEXT,
      "weeklyQuota" INTEGER,
      "rate" INTEGER,
      "color" TEXT,
      "passwordHash" TEXT,
      "privateBalancePaidAt" TIMESTAMP(3),
      "archived" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "Coach_organizationId_name_key" ON ${q(schema, "Coach")}("organizationId", "name")`,
    `CREATE UNIQUE INDEX "Coach_organizationId_color_key" ON ${q(schema, "Coach")}("organizationId", "color")`,

    `CREATE TABLE ${q(schema, "PrivatePayment")} (
      "id" TEXT NOT NULL,
      "coachId" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PrivatePayment_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX "PrivatePayment_coachId_idx" ON ${q(schema, "PrivatePayment")}("coachId")`,
    `CREATE INDEX "PrivatePayment_paidAt_idx" ON ${q(schema, "PrivatePayment")}("paidAt")`,

    `CREATE TABLE ${q(schema, "ClassTemplate")} (
      "id" TEXT NOT NULL,
      "dayOfWeek" INTEGER NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "roomId" TEXT NOT NULL,
      "isPrivate" BOOLEAN NOT NULL DEFAULT false,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "coachId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClassTemplate_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX "ClassTemplate_roomId_idx" ON ${q(schema, "ClassTemplate")}("roomId")`,

    `CREATE TABLE ${q(schema, "ClassInstance")} (
      "id" TEXT NOT NULL,
      "templateId" TEXT,
      "date" TIMESTAMP(3) NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "roomId" TEXT NOT NULL,
      "isPrivate" BOOLEAN NOT NULL DEFAULT false,
      "isTeamEvent" BOOLEAN NOT NULL DEFAULT false,
      "coachId" TEXT,
      "substituteCoachId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PLANNED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ClassInstance_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX "ClassInstance_date_idx" ON ${q(schema, "ClassInstance")}("date")`,
    `CREATE INDEX "ClassInstance_coachId_idx" ON ${q(schema, "ClassInstance")}("coachId")`,
    `CREATE INDEX "ClassInstance_substituteCoachId_idx" ON ${q(schema, "ClassInstance")}("substituteCoachId")`,
    `CREATE INDEX "ClassInstance_roomId_idx" ON ${q(schema, "ClassInstance")}("roomId")`,

    `CREATE TABLE ${q(schema, "ClassReview")} (
      "id" TEXT NOT NULL,
      "classInstanceId" TEXT NOT NULL,
      "briefingNotes" TEXT,
      "generalWuNotes" TEXT,
      "specificWuNotes" TEXT,
      "skillWodNotes" TEXT,
      "coolDownNotes" TEXT,
      "pillarEnseignement" TEXT NOT NULL,
      "pillarObservation" TEXT NOT NULL,
      "pillarCorrection" TEXT NOT NULL,
      "pillarGestionGroupe" TEXT NOT NULL,
      "pillarPresenceAttitude" TEXT NOT NULL,
      "pillarDemonstration" TEXT NOT NULL,
      "identifiedText" TEXT,
      "focusText" TEXT NOT NULL,
      "pastille" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClassReview_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "ClassReview_classInstanceId_key" ON ${q(schema, "ClassReview")}("classInstanceId")`,
    `CREATE INDEX "ClassReview_createdAt_idx" ON ${q(schema, "ClassReview")}("createdAt")`,

    `CREATE TABLE ${q(schema, "CoachWeeklyQuota")} (
      "id" TEXT NOT NULL,
      "coachId" TEXT NOT NULL,
      "weekStart" TIMESTAMP(3) NOT NULL,
      "maxLessons" INTEGER NOT NULL,
      CONSTRAINT "CoachWeeklyQuota_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "CoachWeeklyQuota_coachId_weekStart_key" ON ${q(schema, "CoachWeeklyQuota")}("coachId", "weekStart")`,

    `CREATE TABLE ${q(schema, "PlanningWeek")} (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "weekStart" TIMESTAMP(3) NOT NULL,
      "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PlanningWeek_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "PlanningWeek_organizationId_weekStart_key" ON ${q(schema, "PlanningWeek")}("organizationId", "weekStart")`,

    `CREATE TABLE ${q(schema, "ClassSubmission")} (
      "id" TEXT NOT NULL,
      "classInstanceId" TEXT NOT NULL,
      "coachId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ClassSubmission_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "ClassSubmission_classInstanceId_coachId_key" ON ${q(schema, "ClassSubmission")}("classInstanceId", "coachId")`,
    `CREATE INDEX "ClassSubmission_classInstanceId_idx" ON ${q(schema, "ClassSubmission")}("classInstanceId")`,

    `CREATE TABLE ${q(schema, "BoxClosure")} (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BoxClosure_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "BoxClosure_organizationId_date_key" ON ${q(schema, "BoxClosure")}("organizationId", "date")`,

    `CREATE TABLE ${q(schema, "Unavailability")} (
      "id" TEXT NOT NULL,
      "coachId" TEXT NOT NULL,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "recurring" BOOLEAN NOT NULL DEFAULT false,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "acknowledgedAt" TIMESTAMP(3),
      CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX "Unavailability_coachId_idx" ON ${q(schema, "Unavailability")}("coachId")`,
    `CREATE INDEX "Unavailability_endDate_idx" ON ${q(schema, "Unavailability")}("endDate")`,
  ];
}

// Same relations as prisma/schema.prisma's @relation directives — same-schema
// tenant-to-tenant FKs plus the cross-schema ones back to "public"."Organization".
export function tenantTableForeignKeys(schema: string): string[] {
  const s = (table: string) => q(schema, table);
  return [
    `ALTER TABLE ${s("Room")} ADD CONSTRAINT "Room_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("Coach")} ADD CONSTRAINT "Coach_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("PrivatePayment")} ADD CONSTRAINT "PrivatePayment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES ${s("Coach")}("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassTemplate")} ADD CONSTRAINT "ClassTemplate_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES ${s("Room")}("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassTemplate")} ADD CONSTRAINT "ClassTemplate_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES ${s("Coach")}("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassInstance")} ADD CONSTRAINT "ClassInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES ${s("ClassTemplate")}("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassInstance")} ADD CONSTRAINT "ClassInstance_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES ${s("Room")}("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassInstance")} ADD CONSTRAINT "ClassInstance_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES ${s("Coach")}("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassInstance")} ADD CONSTRAINT "ClassInstance_substituteCoachId_fkey" FOREIGN KEY ("substituteCoachId") REFERENCES ${s("Coach")}("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassReview")} ADD CONSTRAINT "ClassReview_classInstanceId_fkey" FOREIGN KEY ("classInstanceId") REFERENCES ${s("ClassInstance")}("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("CoachWeeklyQuota")} ADD CONSTRAINT "CoachWeeklyQuota_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES ${s("Coach")}("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("PlanningWeek")} ADD CONSTRAINT "PlanningWeek_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassSubmission")} ADD CONSTRAINT "ClassSubmission_classInstanceId_fkey" FOREIGN KEY ("classInstanceId") REFERENCES ${s("ClassInstance")}("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("ClassSubmission")} ADD CONSTRAINT "ClassSubmission_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES ${s("Coach")}("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("BoxClosure")} ADD CONSTRAINT "BoxClosure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE ${s("Unavailability")} ADD CONSTRAINT "Unavailability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES ${s("Coach")}("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  ];
}
