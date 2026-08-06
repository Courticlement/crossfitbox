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
    CONSTRAINT "ClassInstance_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClassInstance" ("coachId", "createdAt", "date", "endTime", "id", "label", "startTime", "status", "templateId", "updatedAt") SELECT "coachId", "createdAt", "date", "endTime", "id", "label", "startTime", "status", "templateId", "updatedAt" FROM "ClassInstance";
DROP TABLE "ClassInstance";
ALTER TABLE "new_ClassInstance" RENAME TO "ClassInstance";
CREATE INDEX "ClassInstance_date_idx" ON "ClassInstance"("date");
CREATE INDEX "ClassInstance_coachId_idx" ON "ClassInstance"("coachId");
CREATE TABLE "new_ClassTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "room" TEXT NOT NULL DEFAULT 'Room 1',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ClassTemplate" ("active", "createdAt", "dayOfWeek", "endTime", "id", "label", "startTime") SELECT "active", "createdAt", "dayOfWeek", "endTime", "id", "label", "startTime" FROM "ClassTemplate";
DROP TABLE "ClassTemplate";
ALTER TABLE "new_ClassTemplate" RENAME TO "ClassTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
