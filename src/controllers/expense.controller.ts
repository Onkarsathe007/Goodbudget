import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import z from "zod";
import { auth } from "../config/auth.config.js";
import redisClient from "../config/cache.config.js";
import prisma from "../config/db.config.js";
import logger from "../config/logs.config.js";
import type { Prisma } from "../generated/prisma/client.js";
import { expenseSchema } from "../types/expenses.types.js";

const expenseController = {
  async getExpenses(req: Request, res: Response) {
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

      const cacheKey = `expenses:${session.user.id}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          source: "cache",
          data: JSON.parse(cached),
        });
      }

      const expense = await prisma.expenses.findMany({
        where: { userId: session.user.id },
        include: {
          category: true,
          account: true,
        },
      });

      const BASE_TTL = 60 * 60 * 24; // 24h
      const JITTER = Math.floor(Math.random() * 300); // up to 5 min
      await redisClient.set(
        cacheKey,
        JSON.stringify(expense),
        "EX",
        BASE_TTL + JITTER,
      );

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      return res.status(200).json({
        source: "db",
        data: expense,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        error: "Failed to fetch expenses",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async getExpenseById(req: Request, res: Response) {
    const id = req.params.id as string;

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

      const expense = await prisma.expenses.findUnique({
        where: { id },
        include: {
          category: true,
          account: true,
        },
      });

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      if (expense.userId !== session.user.id) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only view your own expenses",
        });
      }

      return res.status(200).json({
        success: true,
        data: expense,
      });
    } catch (error) {
      logger.error(error);

      return res.status(500).json({
        error: "Failed to fetch expense",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async setExpenses(req: Request, res: Response) {
    const { category, title, note, amount, type } = req.body;
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

      const categoryData = await prisma.categories.findUnique({
        where: { name: category },
      });
      if (!categoryData) {
        logger.warn("Category not exists");
        return res.status(404).json({ message: "Category Not exists" });
      }
      const categoryId = categoryData.id;

      const accountData = await prisma.budgetAccount.findFirst({
        where: { userId, isDefault: true },
      });

      if (!accountData) {
        return res.status(404).json({
          message: "No account found. Please create your account first.",
        });
      }

      const expenseData = {
        userId,
        categoryId,
        accountId: accountData.id,
        title: title || null,
        note: note || null,
        amount,
        type,
      };

      const parsedData = expenseSchema.parse(expenseData);

      const createData: Prisma.ExpensesUncheckedCreateInput = {
        userId: parsedData.userId,
        categoryId: parsedData.categoryId,
        title: parsedData.title,
        note: parsedData.note,
        amount: parsedData.amount,
        type: parsedData.type,
        accountId: parsedData.accountId,
      };

      try {
        const newExpense = await prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            if (categoryData.type === "EXPENSE") {
              const currentUser = await tx.user.findUnique({
                where: { id: userId },
                select: { current_balance: true },
              });

              if (!currentUser) {
                throw new Error("User not found");
              }

              if (currentUser.current_balance < amount) {
                throw new Error(
                  JSON.stringify({
                    error: "Insufficient balance",
                    message:
                      "Your current balance is insufficient to create this expense",
                    currentBalance: currentUser.current_balance,
                    requiredAmount: amount,
                  }),
                );
              }
            }

            const expense = await tx.expenses.create({
              data: createData,
            });

            await tx.user.update({
              where: { id: userId },
              data: {
                current_balance:
                  categoryData.type === "INCOME"
                    ? { increment: amount }
                    : { decrement: amount },
              },
            });

            await tx.budgetAccount.update({
              where: { id: accountData.id },
              data: {
                currentBalance:
                  categoryData.type === "INCOME"
                    ? { increment: amount }
                    : { decrement: amount },
              },
            });

            return expense;
          },
        );

        await Promise.all([
          redisClient.del(`expenses:${userId}`),
          redisClient.del(`user:balance:${userId}`),
          redisClient.del(`user:stats:${userId}`),
          redisClient.del(`user:profile:${userId}`),
        ]);

        logger.info(`Expense created: ${newExpense.id}`);

        return res.status(201).json({
          success: true,
          message: "Expense created successfully",
          data: newExpense,
        });
      } catch (txError) {
        if (txError instanceof Error && txError.message.startsWith("{")) {
          const errorData = JSON.parse(txError.message);
          return res.status(400).json(errorData);
        }
        throw txError;
      }
    } catch (error) {
      logger.error(error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation error",
          details: error.issues,
        });
      }

      return res.status(500).json({
        error: "Failed to create expense",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async updateExpense(req: Request, res: Response) {
    const id = req.params.id as string;
    const { category, title, note, amount, type, accountId } = req.body;

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

      const existingExpense = await prisma.expenses.findUnique({
        where: { id },
        include: { category: true },
      });

      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      if (existingExpense.userId !== userId) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only update your own expenses",
        });
      }

      let newCategoryData = existingExpense.category;
      let categoryId = existingExpense.categoryId;

      if (category) {
        const fetchedCategory = await prisma.categories.findUnique({
          where: { name: category },
        });
        if (!fetchedCategory) {
          return res.status(404).json({ message: "Category not found" });
        }
        newCategoryData = fetchedCategory;
        categoryId = fetchedCategory.id;
      }

      const updateData: Prisma.ExpensesUncheckedUpdateInput = {};
      if (title !== undefined) updateData.title = title || null;
      if (note !== undefined) updateData.note = note || null;
      if (amount !== undefined) updateData.amount = amount;
      if (type !== undefined) updateData.type = type;
      if (category !== undefined) updateData.categoryId = categoryId;
      if (accountId !== undefined) updateData.accountId = accountId;

      const oldAmount = existingExpense.amount;
      const newAmount = amount !== undefined ? amount : oldAmount;
      const oldType = existingExpense.category.type;
      const newType = newCategoryData.type;

      let balanceChange = oldType === "INCOME" ? -oldAmount : oldAmount;
      balanceChange += newType === "INCOME" ? newAmount : -newAmount;

      try {
        const updatedExpense = await prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            if (balanceChange !== 0) {
              const currentUser = await tx.user.findUnique({
                where: { id: userId },
                select: { current_balance: true },
              });

              if (!currentUser) {
                throw new Error("User not found");
              }

              const newBalance = currentUser.current_balance + balanceChange;
              if (newBalance < 0) {
                throw new Error(
                  JSON.stringify({
                    error: "Insufficient balance",
                    message: "This update would result in negative balance",
                    currentBalance: currentUser.current_balance,
                    requiredBalance: Math.abs(newBalance),
                  }),
                );
              }

              await tx.user.update({
                where: { id: userId },
                data: { current_balance: { increment: balanceChange } },
              });

              await tx.budgetAccount.update({
                where: { id: existingExpense.accountId },
                data: { currentBalance: { increment: balanceChange } },
              });
            }

            const expense = await tx.expenses.update({
              where: { id },
              data: updateData,
            });

            return expense;
          },
        );

        logger.info(`Expense updated: ${updatedExpense.id}`);

        await Promise.all([
          redisClient.del(`expenses:${userId}`),
          redisClient.del(`user:balance:${userId}`),
          redisClient.del(`user:stats:${userId}`),
          redisClient.del(`user:profile:${userId}`),
        ]);

        return res.status(200).json({
          success: true,
          message: "Expense updated successfully",
          data: updatedExpense,
        });
      } catch (txError) {
        if (txError instanceof Error && txError.message.startsWith("{")) {
          const errorData = JSON.parse(txError.message);
          return res.status(400).json(errorData);
        }
        throw txError;
      }
    } catch (error) {
      logger.error(error);

      return res.status(500).json({
        error: "Failed to update expense",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async deleteExpense(req: Request, res: Response) {
    const id = req.params.id as string;

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

      const existingExpense = await prisma.expenses.findUnique({
        where: { id },
        include: { category: true },
      });

      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      if (existingExpense.userId !== userId) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only delete your own expenses",
        });
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.expenses.delete({
          where: { id },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            current_balance:
              existingExpense.category.type === "INCOME"
                ? { decrement: existingExpense.amount }
                : { increment: existingExpense.amount },
          },
        });

        await tx.budgetAccount.update({
          where: { id: existingExpense.accountId },
          data: {
            currentBalance:
              existingExpense.category.type === "INCOME"
                ? { decrement: existingExpense.amount }
                : { increment: existingExpense.amount },
          },
        });
      });

      await Promise.all([
        redisClient.del(`expenses:${userId}`),
        redisClient.del(`user:balance:${userId}`),
        redisClient.del(`user:stats:${userId}`),
        redisClient.del(`user:profile:${userId}`),
      ]);

      logger.info(`Expense deleted: ${id}`);

      return res.status(200).json({
        success: true,
        message: "Expense deleted successfully",
      });
    } catch (error) {
      logger.error(error);

      return res.status(500).json({
        error: "Failed to delete expense",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};

export default expenseController;
