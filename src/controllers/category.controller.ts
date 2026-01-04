import { constrainedMemory } from "node:process";
import type { Request, Response } from "express";
import express, { Router } from "express";
import z, { parse } from "zod";
import { da, tr } from "zod/locales";
import prisma from "../config/db.config.js";
import logger from "../config/logs.config.js";
import { categorySchema } from "../types/category.types.js";

export const CategoryController = {
  async getCategories(req: Request, res: Response) {
    try {
      const response = await prisma.categories.findMany();
      if (response.length === 0) {
        logger.info("user not found", { operation: "getCategories" });
      }
      if (!response) {
        res.status(404).json({ message: "record not found" });
      }
      res.json(response);
    } catch (error) {
      res.status(500).json("Internal Server error");
    }
  },
  async addCategories(req: Request, res: Response) {
    const { name, type, isDefault } = req.body;
    const data = {
      name,
      type,
      isDefault,
    };
    try {
      const validatedData = categorySchema.parse(data);
      await prisma.categories.create({
        data: {
          name: validatedData.name,
          type: validatedData.type,
          isDefault: validatedData.isDefault,
        },
      });
      logger.info(`${validatedData.name} Category Created Successfully`);
      res
        .status(201)
        .json({ message: "Category Created Successfully", data: data });
    } catch (error: any) {
      // Zod Validation Error Handelling
      if (error instanceof z.ZodError) {
        logger.warn("Validation Error", { errors: error.message });
        return res.status(200).json({
          message: "Validation Failed",
          errors: error.message,
        });
      }

      // Unique constraint Violation
      if (error.code === "P2002") {
        logger.warn("Duplicate category name", { name: req.body.name });
        return res.status(409).json({
          message: "A category with this name already exists",
        });
      }
    }
  },
  async deleteCategories(req: Request, res: Response) {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        return res.status(400).json({
          message: "Category ID is required",
        });
      }
      const id = Number.parseInt(idParam, 10);

      if (Number.isNaN(id)) {
        return res.status(400).json({
          message: "Invalid category ID",
        });
      }

      const category = await prisma.categories.findUnique({
        where: { id },
        include: { _count: { select: { expenses: true } } },
      });

      if (!category) {
        logger.warn("Category not found", { categoryId: id });
        return res.status(404).json({
          message: "Category not found",
        });
      }

      // Check if category is used by expenses
      if (category._count.expenses > 0) {
        logger.warn("Cannot delete category with expenses", {
          categoryId: id,
          expenseCount: category._count.expenses,
        });
        return res.status(409).json({
          message: `Cannot delete category. It is being used by ${category._count.expenses} expense(s)`,
        });
      }

      // Protect default categories deletion
      if (category.isDefault) {
        logger.warn("Cannot delete default category", { categoryId: id });
        return res.status(409).json({
          message: "Cannot delete default category",
        });
      }

      // Delete the category
      await prisma.categories.delete({
        where: { id },
      });

      logger.info("Category deleted successfully", { categoryId: id });

      return res.status(200).json({
        message: "Category deleted successfully",
      });
    } catch (error: any) {
      logger.error("Failed to delete category", { error: error.message });
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },

  async updateCategory(req: Request, res: Response) {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).json("Category ID required");
    }
    const id = Number.parseInt(idParam, 10);
    const { name, type, isDefault } = req.body;
    const data = { name, type, isDefault };
    const parsedData = categorySchema.parse(data);

    const existingCategory = await prisma.categories.findUnique({
      where: { id },
    });
    if (!existingCategory) {
      return res.status(404).json({
        message: "Category not found",
      });
      try {
        const result = await prisma.categories.update({
          where: { id: id },
          data: {
            name: parsedData.name,
            type: parsedData.type,
            isDefault: parsedData.isDefault,
          },
        });
        res.status(200).json({ message: "Resource updated Successfully" });
      } catch (error: any) {
        logger.log(error.message);
      }
    }
  },
};
