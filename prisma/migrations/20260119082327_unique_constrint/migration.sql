/*
  Warnings:

  - A unique constraint covering the columns `[userId,name]` on the table `budget_account` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "budget_account_userId_name_key" ON "budget_account"("userId", "name");
