-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "activityLevel" TEXT;
ALTER TABLE "Setting" ADD COLUMN "birthYear" INTEGER;
ALTER TABLE "Setting" ADD COLUMN "goal" TEXT;
ALTER TABLE "Setting" ADD COLUMN "hrTargetMax" INTEGER;
ALTER TABLE "Setting" ADD COLUMN "hrTargetMin" INTEGER;
ALTER TABLE "Setting" ADD COLUMN "sex" TEXT;

-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN "tags" TEXT;

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightKg" REAL,
    "sets" INTEGER,
    "reps" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'strength',
    "durationMin" INTEGER,
    "inclinePct" REAL,
    "speedKmh" REAL,
    "caloriesBurned" INTEGER,
    "notes" TEXT,
    "timeBlockId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Workout" ("createdAt", "date", "durationMin", "id", "notes", "type") SELECT "createdAt", "date", "durationMin", "id", "notes", "type" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE UNIQUE INDEX "Workout_timeBlockId_key" ON "Workout"("timeBlockId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
