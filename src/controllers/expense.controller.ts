import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import z from "zod";
import { auth } from "../config/auth.config.js";
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

      const expense = await prisma.expenses.findMany({
        where: { userId: session.user.id },
        include: {
          category: true,
          account: true,
        },
      });

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      return res.status(200).json({
        success: true,
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

      if (categoryData.type === "EXPENSE") {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { current_balance: true },
        });

        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        if (currentUser.current_balance < amount) {
          return res.status(400).json({
            error: "Insufficient balance",
            message:
              "Your current balance is insufficient to create this expense",
            currentBalance: currentUser.current_balance,
            requiredAmount: amount,
          });
        }
      }

      const newExpense = await prisma.expenses.create({
        data: createData,
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          current_balance:
            categoryData.type === "INCOME"
              ? { increment: amount }
              : { decrement: amount },
        },
      });

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

      if (balanceChange !== 0) {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { current_balance: true },
        });

        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const newBalance = currentUser.current_balance + balanceChange;
        if (newBalance < 0) {
          return res.status(400).json({
            error: "Insufficient balance",
            message: "This update would result in negative balance",
            currentBalance: currentUser.current_balance,
            requiredBalance: Math.abs(newBalance),
          });
        }

        await prisma.user.update({
          where: { id: userId },
          data: { current_balance: { increment: balanceChange } },
        });
      }

      const updatedExpense = await prisma.expenses.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Expense updated: ${updatedExpense.id}`);

      return res.status(200).json({
        success: true,
        message: "Expense updated successfully",
        data: updatedExpense,
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

      await prisma.expenses.delete({
        where: { id },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          current_balance:
            existingExpense.category.type === "INCOME"
              ? { decrement: existingExpense.amount }
              : { increment: existingExpense.amount },
        },
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
