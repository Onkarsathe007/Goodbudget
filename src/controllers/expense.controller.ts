import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import z from "zod";
import { auth } from "../config/auth.config.js";
import prisma from "../config/db.config.js";
import logger from "../config/logs.config.js";
import type { Prisma } from "../generated/prisma/client.js";
import { expenseSchema } from "../types/expenses.types.js";

const expenseController = {
  async getExpenses(_req: Request, res: Response) {
    const result = await prisma.expenses.findMany();
    if (!result) {
      res.status(404).json({ message: "Resource does not exists" });
    }
    res.status(200).json({ result });
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

      if (categoryData.type === "EXPENSE") {
        if (accountData.currentBalance < amount) {
          return res.status(400).json({
            error: "Insufficient balance",
            message: "Account balance is insufficient for this expense",
            accountBalance: accountData.currentBalance,
            requiredAmount: amount,
          });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const newExpense = await tx.expenses.create({
          data: {
            userId: parsedData.userId,
            categoryId: parsedData.categoryId,
            title: parsedData.title,
            note: parsedData.note,
            amount: parsedData.amount,
            type: parsedData.type,
            accountId: parsedData.accountId,
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

        await tx.user.update({
          where: { id: userId },
          data: {
            current_balance:
              categoryData.type === "INCOME"
                ? { increment: amount }
                : { decrement: amount },
          },
        });

        return newExpense;
      });

      const newExpense = result;

      logger.info(`Expense created: ${newExpense.id}`);

      return res.status(201).json({
        success: true,
        message: "Expense created successfully",
        data: newExpense,
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
        include: { category: true, account: true },
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
      let newCategoryId = existingExpense.categoryId;

      if (category) {
        const fetchedCategory = await prisma.categories.findUnique({
          where: { name: category },
        });
        if (!fetchedCategory) {
          return res.status(404).json({ message: "Category not found" });
        }
        newCategoryData = fetchedCategory;
        newCategoryId = fetchedCategory.id;
      }

      let newAccountData = existingExpense.account;
      let newAccountId = existingExpense.accountId;

      if (accountId && accountId !== existingExpense.accountId) {
        const fetchedAccount = await prisma.budgetAccount.findUnique({
          where: { id: accountId },
        });
        if (!fetchedAccount) {
          return res.status(404).json({ message: "Account not found" });
        }
        if (fetchedAccount.userId !== userId) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Account doesn't belong to you",
          });
        }
        newAccountData = fetchedAccount;
        newAccountId = accountId;
      }

      const oldAmount = existingExpense.amount;
      const newAmount = amount !== undefined ? amount : oldAmount;
      const oldCategoryType = existingExpense.category.type;
      const newCategoryType = newCategoryData.type;
      const oldAccountId = existingExpense.accountId;

      const accountChanged = newAccountId !== oldAccountId;

      if (newCategoryType === "EXPENSE") {
        const targetAccount = accountChanged
          ? newAccountData
          : existingExpense.account;
        let availableBalance = targetAccount.currentBalance;

        if (!accountChanged && oldCategoryType === "EXPENSE") {
          availableBalance += oldAmount;
        }

        if (availableBalance < newAmount) {
          return res.status(400).json({
            error: "Insufficient balance",
            message: "Account balance is insufficient for this expense",
            accountBalance: targetAccount.currentBalance,
            requiredAmount: newAmount,
          });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        if (accountChanged) {
          await tx.budgetAccount.update({
            where: { id: oldAccountId },
            data: {
              currentBalance:
                oldCategoryType === "INCOME"
                  ? { decrement: oldAmount }
                  : { increment: oldAmount },
            },
          });

          await tx.budgetAccount.update({
            where: { id: newAccountId },
            data: {
              currentBalance:
                newCategoryType === "INCOME"
                  ? { increment: newAmount }
                  : { decrement: newAmount },
            },
          });
        } else {
          let balanceChange =
            oldCategoryType === "INCOME" ? -oldAmount : oldAmount;
          balanceChange +=
            newCategoryType === "INCOME" ? newAmount : -newAmount;

          if (balanceChange !== 0) {
            await tx.budgetAccount.update({
              where: { id: oldAccountId },
              data: { currentBalance: { increment: balanceChange } },
            });
          }
        }

        let userBalanceChange =
          oldCategoryType === "INCOME" ? -oldAmount : oldAmount;
        userBalanceChange +=
          newCategoryType === "INCOME" ? newAmount : -newAmount;

        if (userBalanceChange !== 0) {
          await tx.user.update({
            where: { id: userId },
            data: { current_balance: { increment: userBalanceChange } },
          });
        }

        const updateData: Prisma.ExpensesUncheckedUpdateInput = {};
        if (title !== undefined) updateData.title = title || null;
        if (note !== undefined) updateData.note = note || null;
        if (amount !== undefined) updateData.amount = amount;
        if (type !== undefined) updateData.type = type;
        if (category !== undefined) updateData.categoryId = newCategoryId;
        if (accountId !== undefined) updateData.accountId = newAccountId;

        const updatedExpense = await tx.expenses.update({
          where: { id },
          data: updateData,
        });

        return updatedExpense;
      });

      logger.info(`Expense updated: ${result.id}`);

      return res.status(200).json({
        success: true,
        message: "Expense updated successfully",
        data: result,
      });
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
        include: { category: true, account: true },
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

      await prisma.$transaction(async (tx) => {
        await tx.expenses.delete({
          where: { id },
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

        await tx.user.update({
          where: { id: userId },
          data: {
            current_balance:
              existingExpense.category.type === "INCOME"
                ? { decrement: existingExpense.amount }
                : { increment: existingExpense.amount },
          },
        });
      });

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
