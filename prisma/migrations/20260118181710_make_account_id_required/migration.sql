/*
  Warnings:

  - Made the column `accountId` on table `Expenses` required. This step will fail if there are existing NULL values in that column.

*/

-- Step 1: Add new columns to budget_account first
ALTER TABLE "budget_account" ADD COLUMN IF NOT EXISTS "currentBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "budget_account" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create default budget accounts for users who have expenses with NULL accountId
INSERT INTO "budget_account" ("id", "userId", "name", "initialBalance", "currentBalance", "type", "isDefault", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  u."id",
  'Default Account',
  COALESCE(u."current_balance", 0),
  COALESCE(u."current_balance", 0),
  'BANK',
  true,
  NOW(),
  NOW()
FROM "user" u
WHERE u."id" IN (
  SELECT DISTINCT "userId" FROM "Expenses" WHERE "accountId" IS NULL
)
AND NOT EXISTS (
  SELECT 1 FROM "budget_account" ba WHERE ba."userId" = u."id" AND ba."isDefault" = true
);

-- Step 3: Update NULL accountId in Expenses to use the user's default budget account
UPDATE "Expenses" e
SET "accountId" = (
  SELECT ba."id" 
  FROM "budget_account" ba 
  WHERE ba."userId" = e."userId" AND ba."isDefault" = true
  LIMIT 1
)
WHERE e."accountId" IS NULL;

-- Step 4: Drop the old foreign key constraint
ALTER TABLE "Expenses" DROP CONSTRAINT IF EXISTS "Expenses_accountId_fkey";

-- Step 5: Make accountId required
ALTER TABLE "Expenses" ALTER COLUMN "accountId" SET NOT NULL;

-- Step 6: Add the foreign key constraint back
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "budget_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
