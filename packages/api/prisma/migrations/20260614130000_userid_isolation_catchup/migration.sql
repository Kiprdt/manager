-- DropIndex
DROP INDEX "Meal_date_key";

-- DropIndex
DROP INDEX "Reflection_date_key";

-- DropIndex
DROP INDEX "WeightEntry_date_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "FinanceInstrument" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "FinanceTx" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Meal" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Reflection" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Supplement" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "TelegramChat" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "WeightEntry" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "telegramBotToken" TEXT,
    "telegramChatId" TEXT,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "llmApiKey" TEXT,
    "llmBaseUrl" TEXT,
    "llmModel" TEXT,
    "proxyUrl" TEXT,
    "heightCm" INTEGER,
    "weightGoalKg" REAL,
    "sex" TEXT,
    "birthYear" INTEGER,
    "activityLevel" TEXT,
    "goal" TEXT,
    "caloriesGoal" INTEGER,
    "proteinGoal" INTEGER,
    "carbsGoal" INTEGER,
    "fatGoal" INTEGER,
    "hrTargetMin" INTEGER,
    "hrTargetMax" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Setting" ("activityLevel", "birthYear", "caloriesGoal", "carbsGoal", "fatGoal", "goal", "heightCm", "hrTargetMax", "hrTargetMin", "id", "llmApiKey", "llmBaseUrl", "llmModel", "proteinGoal", "proxyUrl", "sex", "telegramBotToken", "telegramChatId", "telegramEnabled", "updatedAt", "weightGoalKg") SELECT "activityLevel", "birthYear", "caloriesGoal", "carbsGoal", "fatGoal", "goal", "heightCm", "hrTargetMax", "hrTargetMin", "id", "llmApiKey", "llmBaseUrl", "llmModel", "proteinGoal", "proxyUrl", "sex", "telegramBotToken", "telegramChatId", "telegramEnabled", "updatedAt", "weightGoalKg" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE UNIQUE INDEX "Setting_userId_key" ON "Setting"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "FinanceInstrument_userId_idx" ON "FinanceInstrument"("userId");

-- CreateIndex
CREATE INDEX "FinanceTx_userId_idx" ON "FinanceTx"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Meal_userId_date_key" ON "Meal"("userId", "date");

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Reflection_userId_date_key" ON "Reflection"("userId", "date");

-- CreateIndex
CREATE INDEX "Supplement_userId_idx" ON "Supplement"("userId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "TelegramChat_userId_idx" ON "TelegramChat"("userId");

-- CreateIndex
CREATE INDEX "TimeBlock_userId_idx" ON "TimeBlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeightEntry_userId_date_key" ON "WeightEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "Workout_userId_idx" ON "Workout"("userId");

