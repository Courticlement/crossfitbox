-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data: only users with role='COACH' become Coach rows (the ADMIN
-- user is dropped — head coach access no longer goes through a user record).
INSERT INTO "Coach" ("id", "name", "createdAt")
SELECT "id", "name", "createdAt" FROM "User" WHERE "role" = 'COACH';

CREATE UNIQUE INDEX "Coach_name_key" ON "Coach"("name");

-- DropIndex
DROP INDEX "User_email_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClassInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "room" TEXT NOT NULL DEFAULT 'Room 1',
    "coachId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClassInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClassTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClassInstance_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClassInstance" ("coachId", "createdAt", "date", "endTime", "id", "label", "room", "startTime", "status", "templateId", "updatedAt") SELECT "coachId", "createdAt", "date", "endTime", "id", "label", "room", "startTime", "status", "templateId", "updatedAt" FROM "ClassInstance";
DROP TABLE "ClassInstance";
ALTER TABLE "new_ClassInstance" RENAME TO "ClassInstance";
CREATE INDEX "ClassInstance_date_idx" ON "ClassInstance"("date");
CREATE INDEX "ClassInstance_coachId_idx" ON "ClassInstance"("coachId");
CREATE TABLE "new_CoachWeeklyQuota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "maxLessons" INTEGER NOT NULL,
    CONSTRAINT "CoachWeeklyQuota_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CoachWeeklyQuota" ("coachId", "id", "maxLessons", "weekStart") SELECT "coachId", "id", "maxLessons", "weekStart" FROM "CoachWeeklyQuota";
DROP TABLE "CoachWeeklyQuota";
ALTER TABLE "new_CoachWeeklyQuota" RENAME TO "CoachWeeklyQuota";
CREATE UNIQUE INDEX "CoachWeeklyQuota_coachId_weekStart_key" ON "CoachWeeklyQuota"("coachId", "weekStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
