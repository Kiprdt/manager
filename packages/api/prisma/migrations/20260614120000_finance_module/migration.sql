-- CreateTable
CREATE TABLE "FinAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "balance" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "cardNumber" TEXT,
    "color" TEXT,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "interestRate" REAL NOT NULL DEFAULT 0,
    "minPaymentPct" REAL NOT NULL DEFAULT 5,
    "paymentDay" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FinBalanceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "balance" REAL NOT NULL,
    "recordedDate" DATETIME NOT NULL,
    CONSTRAINT "FinBalanceHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '💸',
    "parentId" TEXT,
    CONSTRAINT "FinCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "amount" REAL NOT NULL,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "plannedAmount" REAL NOT NULL,
    "monthYear" TEXT NOT NULL,
    "alertThreshold" REAL NOT NULL DEFAULT 80,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FinGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "deadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FinRecurrentPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Расход',
    "category" TEXT,
    "subcategory" TEXT,
    "amount" REAL NOT NULL,
    "accountId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinRecurrentPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinShoppingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "price" REAL NOT NULL DEFAULT 0,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "FinAccount_userId_idx" ON "FinAccount"("userId");

-- CreateIndex
CREATE INDEX "FinBalanceHistory_accountId_idx" ON "FinBalanceHistory"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "FinBalanceHistory_accountId_recordedDate_key" ON "FinBalanceHistory"("accountId", "recordedDate");

-- CreateIndex
CREATE INDEX "FinCategory_userId_idx" ON "FinCategory"("userId");

-- CreateIndex
CREATE INDEX "FinCategory_parentId_idx" ON "FinCategory"("parentId");

-- CreateIndex
CREATE INDEX "FinTransaction_userId_idx" ON "FinTransaction"("userId");

-- CreateIndex
CREATE INDEX "FinTransaction_accountId_idx" ON "FinTransaction"("accountId");

-- CreateIndex
CREATE INDEX "FinTransaction_date_idx" ON "FinTransaction"("date");

-- CreateIndex
CREATE INDEX "FinBudget_userId_idx" ON "FinBudget"("userId");

-- CreateIndex
CREATE INDEX "FinGoal_userId_idx" ON "FinGoal"("userId");

-- CreateIndex
CREATE INDEX "FinRecurrentPayment_userId_idx" ON "FinRecurrentPayment"("userId");

-- CreateIndex
CREATE INDEX "FinShoppingItem_userId_idx" ON "FinShoppingItem"("userId");

