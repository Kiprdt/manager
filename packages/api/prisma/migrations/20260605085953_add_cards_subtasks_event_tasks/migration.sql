-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN "attendees" TEXT;
ALTER TABLE "TimeBlock" ADD COLUMN "location" TEXT;
ALTER TABLE "TimeBlock" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "_EventTasks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EventTasks_A_fkey" FOREIGN KEY ("A") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EventTasks_B_fkey" FOREIGN KEY ("B") REFERENCES "TimeBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER,
    "dueAt" DATETIME,
    "recurrenceRule" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("completedAt", "createdAt", "description", "estimatedMinutes", "id", "priority", "status", "title") SELECT "completedAt", "createdAt", "description", "estimatedMinutes", "id", "priority", "status", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "_EventTasks_AB_unique" ON "_EventTasks"("A", "B");

-- CreateIndex
CREATE INDEX "_EventTasks_B_index" ON "_EventTasks"("B");
