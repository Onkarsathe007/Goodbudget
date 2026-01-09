import { auth } from "../config/auth.config.js";
import { fromNodeHeaders } from "better-auth/node"; // FromNodeHeaders from Better Auth to convert Express headers
import type { Request, Response } from "express";
import logger from "../config/logs.config.js";
import prisma from "../config/db.config.js";
import { expenseSchema } from "../types/expenses.types.js";
import z from "zod";

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
      logger.info(session.user.id);

      const categoryData = await prisma.categories.findUnique({
        where: { name: category },
      });
      if (!categoryData) {
        logger.warn("Category not exists");
        return res.status(404).json({ message: "Category Not exists" });
      }
      const categoryId = categoryData.id;

      const expenseData = {
        userId,
        categoryId,
        accountId: accountId || undefined,
        title: title || null,
        note: note || null,
        amount,
        type,
      };

      const parsedData = expenseSchema.parse(expenseData);

      const createData: any = {
        userId: parsedData.userId,
        categoryId: parsedData.categoryId,
        title: parsedData.title,
        note: parsedData.note,
        amount: parsedData.amount,
        type: parsedData.type,
      };

      if (accountId) {
        createData.accountId = accountId;
      }

      const newExpense = await prisma.expenses.create({
        data: createData,
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

      let categoryId = existingExpense.categoryId;
      if (category) {
        const categoryData = await prisma.categories.findUnique({
          where: { name: category },
        });
        if (!categoryData) {
          return res.status(404).json({ message: "Category not found" });
        }
        categoryId = categoryData.id;
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title || null;
      if (note !== undefined) updateData.note = note || null;
      if (amount !== undefined) updateData.amount = amount;
      if (type !== undefined) updateData.type = type;
      if (category !== undefined) updateData.categoryId = categoryId;
      if (accountId !== undefined) updateData.accountId = accountId || null;

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
