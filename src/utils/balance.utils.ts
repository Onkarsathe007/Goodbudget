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
