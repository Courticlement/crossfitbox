-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "weeklyQuota" INTEGER,
    "accessToken" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTemplate" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "room" TEXT NOT NULL DEFAULT 'Room 1',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "coachId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "room" TEXT NOT NULL DEFAULT 'Room 1',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "coachId" TEXT,
    "substituteCoachId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachWeeklyQuota" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "maxLessons" INTEGER NOT NULL,

    CONSTRAINT "CoachWeeklyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningWeek" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubmission" (
    "id" TEXT NOT NULL,
    "classInstanceId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxClosure" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoxClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unavailability" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coach_name_key" ON "Coach"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_accessToken_key" ON "Coach"("accessToken");

-- CreateIndex
CREATE INDEX "ClassInstance_date_idx" ON "ClassInstance"("date");

-- CreateIndex
CREATE INDEX "ClassInstance_coachId_idx" ON "ClassInstance"("coachId");

-- CreateIndex
CREATE INDEX "ClassInstance_substituteCoachId_idx" ON "ClassInstance"("substituteCoachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachWeeklyQuota_coachId_weekStart_key" ON "CoachWeeklyQuota"("coachId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningWeek_weekStart_key" ON "PlanningWeek"("weekStart");

-- CreateIndex
CREATE INDEX "ClassSubmission_classInstanceId_idx" ON "ClassSubmission"("classInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubmission_classInstanceId_coachId_key" ON "ClassSubmission"("classInstanceId", "coachId");

-- CreateIndex
CREATE UNIQUE INDEX "BoxClosure_date_key" ON "BoxClosure"("date");

-- CreateIndex
CREATE INDEX "Unavailability_coachId_idx" ON "Unavailability"("coachId");

-- CreateIndex
CREATE INDEX "Unavailability_endDate_idx" ON "Unavailability"("endDate");

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassInstance" ADD CONSTRAINT "ClassInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClassTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassInstance" ADD CONSTRAINT "ClassInstance_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassInstance" ADD CONSTRAINT "ClassInstance_substituteCoachId_fkey" FOREIGN KEY ("substituteCoachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachWeeklyQuota" ADD CONSTRAINT "CoachWeeklyQuota_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubmission" ADD CONSTRAINT "ClassSubmission_classInstanceId_fkey" FOREIGN KEY ("classInstanceId") REFERENCES "ClassInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubmission" ADD CONSTRAINT "ClassSubmission_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
