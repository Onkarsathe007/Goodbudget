import prisma from "../config/db.config.js";

export async function calculateUserTotalBalance(
  userId: string,
): Promise<number> {
  const accounts = await prisma.budgetAccount.findMany({
    where: { userId },
    select: { currentBalance: true },
  });

  return accounts.reduce((total, account) => total + account.currentBalance, 0);
}

export async function syncUserBalance(userId: string): Promise<void> {
  const totalBalance = await calculateUserTotalBalance(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { current_balance: totalBalance },
  });
}

export async function reconcileUserBalance(
  userId: string,
): Promise<{
  needsReconciliation: boolean;
  difference: number;
  fixed: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { current_balance: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const calculatedBalance = await calculateUserTotalBalance(userId);
  const difference = calculatedBalance - user.current_balance;

  if (difference !== 0) {
    await syncUserBalance(userId);
    return { needsReconciliation: true, difference, fixed: true };
  }

  return { needsReconciliation: false, difference: 0, fixed: false };
}

export async function validateBalanceConsistency(
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { current_balance: true },
  });

  if (!user) {
    return false;
  }

  const calculatedBalance = await calculateUserTotalBalance(userId);
  return user.current_balance === calculatedBalance;
}
