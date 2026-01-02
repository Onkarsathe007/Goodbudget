/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `initialBalance` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `providerAccountId` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `expires` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `sessionToken` on the `session` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerId,accountId]` on the table `account` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "userRole" AS ENUM ('ADMIN', 'USER');

-- DropForeignKey
ALTER TABLE "Expenses" DROP CONSTRAINT "Expenses_accountId_fkey";

-- DropIndex
DROP INDEX "account_provider_providerAccountId_key";

-- DropIndex
DROP INDEX "session_sessionToken_key";

-- AlterTable
ALTER TABLE "account" DROP COLUMN "expiresAt",
DROP COLUMN "initialBalance",
DROP COLUMN "name",
DROP COLUMN "provider",
DROP COLUMN "providerAccountId",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "expires",
DROP COLUMN "sessionToken";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" "userRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "budget_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'anonymous',
    "initialBalance" INTEGER NOT NULL DEFAULT 0,
    "type" "AccountType" NOT NULL DEFAULT 'BANK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_account_userId_idx" ON "budget_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- AddForeignKey
ALTER TABLE "budget_account" ADD CONSTRAINT "budget_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "budget_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
