/*
  Warnings:

  - You are about to drop the column `name` on the `Meal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "caloriesGoal" INTEGER;
ALTER TABLE "Setting" ADD COLUMN "carbsGoal" INTEGER;
ALTER TABLE "Setting" ADD COLUMN "fatGoal" INTEGER;
ALTER TABLE "Setting" ADD COLUMN "proteinGoal" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "calories" INTEGER,
    "protein" INTEGER,
    "carbs" INTEGER,
    "fat" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Meal" ("calories", "carbs", "createdAt", "date", "fat", "id", "protein") SELECT "calories", "carbs", "createdAt", "date", "fat", "id", "protein" FROM "Meal";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
CREATE UNIQUE INDEX "Meal_date_key" ON "Meal"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
