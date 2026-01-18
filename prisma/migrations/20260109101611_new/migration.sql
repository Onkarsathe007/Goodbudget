-- DropForeignKey
ALTER TABLE "Expenses" DROP CONSTRAINT "Expenses_accountId_fkey";

-- AlterTable
ALTER TABLE "Expenses" ALTER COLUMN "accountId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "budget_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
