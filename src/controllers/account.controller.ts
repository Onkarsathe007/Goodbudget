import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import { auth } from "../config/auth.config.js";
import redisClient from "../config/cache.config.js";
import prisma from "../config/db.config.js";
import logger from "../config/logs.config.js";
import { accountSchema } from "../types/account.types.js";
import { syncUserBalance } from "../utils/balance.utils.js";

const accountController = {
  async getAccounts(req: Request, res: Response) {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session || !session.user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "You must be logged in",
        });
      }

      const userId = session.user.id;

      const result = await prisma.budgetAccount.findMany({
        where: { userId },
      });

      if (!result || result.length === 0) {
        return res.status(200).json({ message: "Accounts not Found" });
      }

      res.status(200).json({ result });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ message: "INTERNAL SERVER ERROR" });
    }
  },

  async getAccountById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const response = await prisma.budgetAccount.findUnique({
        where: { id },
      });
      if (!response) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.status(200).json({ response });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ message: "INTERNAL SERVER ERROR" });
    }
  },

  async createAccount(req: Request, res: Response) {
    try {
      const { name, initialBalance, type, isDefault } = req.body;

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session || !session.user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "You must be logged in",
        });
      }

      const userId = session.user.id;
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        return res.status(404).json({
          error: "User not found",
          message: "User record doesn't exist in database",
        });
      }

      const parsedData = accountSchema.parse({
        userId,
        name,
        initialBalance,
        currentBalance: initialBalance,
        type,
        isDefault,
      });

      const existingAccount = await prisma.budgetAccount.findFirst({
        where: { userId, name: parsedData.name },
      });

      if (existingAccount) {
        return res.status(409).json({
          error: "Conflict",
          message: "Account with this name already exists",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        if (parsedData.isDefault) {
          await tx.budgetAccount.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
        }

        const account = await tx.budgetAccount.create({
          data: {
            userId: parsedData.userId,
            name: parsedData.name,
            initialBalance: parsedData.initialBalance,
            currentBalance: parsedData.currentBalance,
            type: parsedData.type,
            isDefault: parsedData.isDefault,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            current_balance: { increment: parsedData.initialBalance },
          },
        });

        return account;
      });

      await Promise.all([
        redisClient.del(`user:balance:${userId}`),
        redisClient.del(`user:stats:${userId}`),
        redisClient.del(`user:profile:${userId}`),
      ]);

      return res.status(201).json({
        success: true,
        message: "Account created successfully",
        data: result,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({ message: "INTERNAL SERVER ERROR" });
    }
  },

  async updateAccount(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { name, currentBalance, type, isDefault } = req.body;

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session || !session.user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "You must be logged in",
        });
      }

      const userId = session.user.id;

      const existingAccount = await prisma.budgetAccount.findUnique({
        where: { id },
      });

      if (!existingAccount) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (existingAccount.userId !== userId) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only update your own accounts",
        });
      }

      if (name) {
        const duplicateAccount = await prisma.budgetAccount.findFirst({
          where: {
            userId,
            name,
            id: { not: id },
          },
        });

        if (duplicateAccount) {
          return res.status(409).json({
            error: "Conflict",
            message: "Account with this name already exists",
          });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        if (isDefault && !existingAccount.isDefault) {
          await tx.budgetAccount.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (type !== undefined) updateData.type = type;
        if (isDefault !== undefined) updateData.isDefault = isDefault;

        if (currentBalance !== undefined) {
          const balanceDifference =
            currentBalance - existingAccount.currentBalance;
          updateData.currentBalance = currentBalance;

          await tx.user.update({
            where: { id: userId },
            data: {
              current_balance: { increment: balanceDifference },
            },
          });
        }

        const account = await tx.budgetAccount.update({
          where: { id },
          data: updateData,
        });

        return account;
      });

      await Promise.all([
        redisClient.del(`user:balance:${userId}`),
        redisClient.del(`user:stats:${userId}`),
        redisClient.del(`user:profile:${userId}`),
      ]);

      return res.status(200).json({
        success: true,
        message: "Account updated successfully",
        data: result,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({ message: "INTERNAL SERVER ERROR" });
    }
  },

  async deleteAccount(req: Request, res: Response) {
    try {
      const id = String(req.params.id);

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session || !session.user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "You must be logged in",
        });
      }

      const userId = session.user.id;

      const existingAccount = await prisma.budgetAccount.findUnique({
        where: { id },
        include: { _count: { select: { expenses: true } } },
      });

      if (!existingAccount) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (existingAccount.userId !== userId) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only delete your own accounts",
        });
      }

      if (existingAccount._count.expenses > 0) {
        return res.status(409).json({
          error: "Conflict",
          message: `Cannot delete account. It has ${existingAccount._count.expenses} expense(s) associated with it`,
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.budgetAccount.delete({
          where: { id },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            current_balance: { decrement: existingAccount.currentBalance },
          },
        });
      });

      await Promise.all([
        redisClient.del(`user:balance:${userId}`),
        redisClient.del(`user:stats:${userId}`),
        redisClient.del(`user:profile:${userId}`),
      ]);

      return res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({ message: "INTERNAL SERVER ERROR" });
    }
  },
};

export default accountController;
