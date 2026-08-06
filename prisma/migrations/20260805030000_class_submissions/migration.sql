-- CreateTable
CREATE TABLE "ClassSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classInstanceId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attendeeCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassSubmission_classInstanceId_fkey" FOREIGN KEY ("classInstanceId") REFERENCES "ClassInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassSubmission_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ClassSubmission_classInstanceId_idx" ON "ClassSubmission"("classInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubmission_classInstanceId_coachId_key" ON "ClassSubmission"("classInstanceId", "coachId");
