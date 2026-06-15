-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scheduleType" TEXT NOT NULL DEFAULT 'daily',
    "weekdays" TEXT,
    "weeklyTarget" INTEGER,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "reminderTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Habit" ("active", "color", "createdAt", "id", "title") SELECT "active", "color", "createdAt", "id", "title" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
CREATE TABLE "new_HabitEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HabitEntry_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HabitEntry" ("createdAt", "date", "habitId", "id") SELECT "createdAt", "date", "habitId", "id" FROM "HabitEntry";
DROP TABLE "HabitEntry";
ALTER TABLE "new_HabitEntry" RENAME TO "HabitEntry";
CREATE UNIQUE INDEX "HabitEntry_habitId_date_key" ON "HabitEntry"("habitId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
