-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetValue" REAL,
    "startValue" REAL,
    "unit" TEXT,
    "dueAt" DATETIME,
    "habitId" TEXT,
    "categoryId" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Goal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinanceTx" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT,
    "categoryId" TEXT,
    "note" TEXT,
    "date" DATETIME NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceTx_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinanceTx" ("amount", "category", "createdAt", "date", "id", "note", "recurring", "type") SELECT "amount", "category", "createdAt", "date", "id", "note", "recurring", "type" FROM "FinanceTx";
DROP TABLE "FinanceTx";
ALTER TABLE "new_FinanceTx" RENAME TO "FinanceTx";
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
    "goalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("actualMinutes", "categoryId", "completedAt", "createdAt", "description", "dueAllDay", "dueAt", "estimatedMinutes", "id", "notes", "parentId", "priority", "recurrenceRule", "status", "tags", "title") SELECT "actualMinutes", "categoryId", "completedAt", "createdAt", "description", "dueAllDay", "dueAt", "estimatedMinutes", "id", "notes", "parentId", "priority", "recurrenceRule", "status", "tags", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "categoryId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'strength',
    "durationMin" INTEGER,
    "inclinePct" REAL,
    "speedKmh" REAL,
    "caloriesBurned" INTEGER,
    "notes" TEXT,
    "timeBlockId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workout_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Workout" ("caloriesBurned", "createdAt", "date", "durationMin", "id", "inclinePct", "kind", "notes", "speedKmh", "timeBlockId", "type") SELECT "caloriesBurned", "createdAt", "date", "durationMin", "id", "inclinePct", "kind", "notes", "speedKmh", "timeBlockId", "type" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE UNIQUE INDEX "Workout_timeBlockId_key" ON "Workout"("timeBlockId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
