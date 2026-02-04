import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import z from "zod";
import { auth } from "../config/auth.config.js";
import redisClient from "../config/cache.config.js";
import prisma from "../config/db.config.js";
import logger from "../config/logs.config.js";
import { updateProfileSchema } from "../types/user.types.js";
import {
  calculateUserTotalBalance,
  reconcileUserBalance,
  validateBalanceConsistency,
} from "../utils/balance.utils.js";

const userController = {
  async getProfile(req: Request, res: Response) {
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

      const cacheKey = `user:profile:${session.user.id}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          source: "cache",
          success: true,
          data: JSON.parse(cached),
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          current_balance: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          emailVerified: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }

      const BASE_TTL = 60 * 60 * 2; // 2h
      const JITTER = Math.floor(Math.random() * 300); // up to 5 min
      await redisClient.set(
        cacheKey,
        JSON.stringify(user),
        "EX",
        BASE_TTL + JITTER,
      );

      return res.status(200).json({
        source: "db",
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        error: "Failed to fetch profile",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async updateProfile(req: Request, res: Response) {
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

      const parsedData = updateProfileSchema.parse(req.body);

      const updateData: { name?: string; image?: string } = {};
      if (parsedData.name !== undefined) updateData.name = parsedData.name;
      if (parsedData.image !== undefined) updateData.image = parsedData.image;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error: "Bad Request",
          message: "No valid fields to update",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          current_balance: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          emailVerified: true,
        },
      });

      await Promise.all([
        redisClient.del(`user:profile:${session.user.id}`),
        redisClient.del(`user:stats:${session.user.id}`),
      ]);

      logger.info(`Profile updated for user: ${session.user.id}`);

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      logger.error(error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation error",
          details: error.issues,
        });
      }

      return res.status(500).json({
        error: "Failed to update profile",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async getBalance(req: Request, res: Response) {
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

      const cacheKey = `user:balance:${session.user.id}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          source: "cache",
          success: true,
          data: { balance: Number.parseInt(cached, 10) },
        });
      }

      const totalBalance = await calculateUserTotalBalance(session.user.id);

      const BASE_TTL = 60 * 30; // 30 min
      const JITTER = Math.floor(Math.random() * 60); // up to 1 min
      await redisClient.set(
        cacheKey,
        totalBalance.toString(),
        "EX",
        BASE_TTL + JITTER,
      );

      return res.status(200).json({
        source: "db",
        success: true,
        data: { balance: totalBalance },
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        error: "Failed to fetch balance",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async getStats(req: Request, res: Response) {
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

      const cacheKey = `user:stats:${session.user.id}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          source: "cache",
          success: true,
          data: JSON.parse(cached),
        });
      }

      const [totalExpenses, totalAccounts, totalIncome, totalExpenseAmount] =
        await Promise.all([
          prisma.expenses.count({
            where: {
              userId: session.user.id,
              category: { type: "EXPENSE" },
            },
          }),
          prisma.budgetAccount.count({
            where: { userId: session.user.id },
          }),
          prisma.expenses.aggregate({
            where: {
              userId: session.user.id,
              category: { type: "INCOME" },
            },
            _sum: { amount: true },
          }),
          prisma.expenses.aggregate({
            where: {
              userId: session.user.id,
              category: { type: "EXPENSE" },
            },
            _sum: { amount: true },
          }),
        ]);

      const stats = {
        totalExpenses,
        totalAccounts,
        totalIncome: totalIncome._sum.amount || 0,
        totalExpenseAmount: totalExpenseAmount._sum.amount || 0,
        currentBalance: await calculateUserTotalBalance(session.user.id),
      };

      const BASE_TTL = 60 * 15; // 15 min
      const JITTER = Math.floor(Math.random() * 60); // up to 1 min
      await redisClient.set(
        cacheKey,
        JSON.stringify(stats),
        "EX",
        BASE_TTL + JITTER,
      );

      return res.status(200).json({
        source: "db",
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        error: "Failed to fetch statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async reconcileBalance(req: Request, res: Response) {
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

      const result = await reconcileUserBalance(session.user.id);

      if (result.needsReconciliation) {
        await Promise.all([
          redisClient.del(`user:balance:${session.user.id}`),
          redisClient.del(`user:stats:${session.user.id}`),
          redisClient.del(`user:profile:${session.user.id}`),
        ]);

        logger.warn(
          `Balance reconciliation performed for user ${session.user.id}, difference: ${result.difference}`,
        );

        return res.status(200).json({
          success: true,
          message: "Balance reconciled successfully",
          data: {
            wasInconsistent: true,
            difference: result.difference,
            fixed: result.fixed,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Balance is already consistent",
        data: {
          wasInconsistent: false,
          difference: 0,
          fixed: false,
        },
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        error: "Failed to reconcile balance",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async validateBalance(req: Request, res: Response) {
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

      const isConsistent = await validateBalanceConsistency(session.user.id);

      return res.status(200).json({
        success: true,
        data: { isConsistent },
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        error: "Failed to validate balance",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};

export default userController;
