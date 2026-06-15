-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "dueAt" DATETIME,
    "dueAllDay" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "tags" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("actualMinutes", "completedAt", "createdAt", "description", "dueAllDay", "dueAt", "estimatedMinutes", "id", "notes", "parentId", "priority", "recurrenceRule", "status", "tags", "title") SELECT "actualMinutes", "completedAt", "createdAt", "description", "dueAllDay", "dueAt", "estimatedMinutes", "id", "notes", "parentId", "priority", "recurrenceRule", "status", "tags", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_TimeBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "taskId" TEXT,
    "categoryId" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "color" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "attendees" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeBlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeBlock_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TimeBlock" ("attendees", "color", "createdAt", "endAt", "id", "isAllDay", "location", "notes", "recurrenceRule", "startAt", "taskId", "title") SELECT "attendees", "color", "createdAt", "endAt", "id", "isAllDay", "location", "notes", "recurrenceRule", "startAt", "taskId", "title" FROM "TimeBlock";
DROP TABLE "TimeBlock";
ALTER TABLE "new_TimeBlock" RENAME TO "TimeBlock";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
